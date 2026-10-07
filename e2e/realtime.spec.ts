import { expect, goToCheckout, openReview, test } from './fixtures'

test.describe('Tempo real (Socket.IO via MSW)', () => {
  test('preço alterado durante o checkout atualiza o resumo e exige nova confirmação', async ({ app, page }) => {
    await goToCheckout(app, page, ['golden-signal-160'])
    // No mobile o frame mostra só o total (sem a lista "Seus NFTs").
    const summary = app.isMobile ? page.locator('#conteudo') : page.getByRole('complementary', { name: 'Seus NFTs' })
    await expect(summary.getByText('0.406 ETH')).toBeVisible()
    const review = await openReview(page)

    // O evento sai do servidor simulado e chega pelo socket.io-client.
    await app.mocks((mocks) => mocks.changePrice('golden-signal-160', '0.49'))
    await expect(page.getByTestId('cart-notice')).toContainText('mudou de 0.39 para 0.49 ETH')
    await expect(review.getByTestId('quote-changed')).toBeVisible()
    await expect(review.getByTestId('quote-changed')).toContainText('Golden Signal #160: 0.39 → 0.49 ETH')
    const confirm = review.getByRole('button', { name: 'Confirmar e pagar' })
    await expect(confirm).toBeDisabled()

    await review.getByRole('button', { name: 'Revisar novos valores' }).click()
    await expect(review.getByText('0.506 ETH')).toBeVisible()
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(page.getByTestId('order-receipt')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('order-receipt').getByText('0.506 ETH').first()).toBeVisible()
  })

  test('cotação desatualizada é rejeitada pela API mesmo sem o evento', async ({ app, page }) => {
    await goToCheckout(app, page, ['golden-signal-160'])
    const review = await openReview(page)
    // Evento perdido: o preço muda apenas na API; a criação do pedido revalida a cotação.
    await app.mocks((mocks) => mocks.changePrice('golden-signal-160', '0.45', { silent: true }))
    await review.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(review.getByText('Os valores do pedido mudaram. Revise e confirme novamente.')).toBeVisible()
    await expect(review.getByTestId('quote-changed')).toBeVisible()
    expect(await app.mocks((mocks) => mocks.snapshot().orders)).toHaveLength(0)
  })

  test('eventos duplicados ou antigos não regridem o estado', async ({ app, page }) => {
    await app.open('/nft/golden-signal-160')
    await expect(page.getByRole('heading', { level: 1, name: 'Golden Signal #160' })).toBeVisible()
    const price = page.locator('#conteudo header').getByText(/ETH/).first()
    await expect(price).toHaveText(/0\.39/)

    await app.mocks((mocks) => mocks.changePrice('golden-signal-160', '0.55'))
    await expect(price).toHaveText(/0\.55/)

    // Duplicata (mesmo id/versão) e evento com versão antiga.
    await app.mocks((mocks) => mocks.realtime.replayLast('nft.updated'))
    await app.mocks((mocks) => mocks.realtime.emitStale('golden-signal-160', '0.01'))
    await page.waitForTimeout(800)
    await expect(price).toHaveText(/0\.55/)
  })

  test('aviso de alteração aparece no carrinho uma única vez para eventos duplicados', async ({ app, page }) => {
    await app.open('/')
    await app.addToCart('golden-signal-160')
    await page.goto('/carrinho')
    await expect(app.cartItems()).toHaveCount(1)
    await app.mocks((mocks) => mocks.changePrice('golden-signal-160', '0.42'))
    await expect(page.getByTestId('cart-notice')).toHaveCount(1)
    await app.mocks((mocks) => mocks.realtime.replayLast('nft.updated'))
    await page.waitForTimeout(600)
    await expect(page.getByTestId('cart-notice')).toHaveCount(1)
    await expect(app.cartItems().first()).toContainText('Preço atualizado (antes 0.39 ETH)')
    await expect(app.liveRegion()).toContainText('O preço de Golden Signal #160 mudou')
  })

  test('desconexão com pedido pendente: reconecta e recupera sem nova compra', async ({ app, page }) => {
    await goToCheckout(app, page, ['golden-signal-160'], 'payment-pending')
    const review = await openReview(page)
    await review.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const orderUrl = page.url()

    // Queda da conexão de tempo real e recarga da página com o pedido pendente.
    await app.mocks((mocks) => mocks.realtime.drop())
    await page.reload()
    await app.ready()
    await expect(page).toHaveURL(orderUrl)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await expect.poll(() => app.mocks((mocks) => mocks.realtime.clients().length)).toBeGreaterThan(0)

    // A liquidação ocorre no servidor simulado; o cliente recebe order.updated.
    const orderId = orderUrl.split('/').pop()!
    await app.mocks((mocks) => mocks.settleOrder(document.location.pathname.split('/').pop()!))
    await expect(page.getByTestId('order-receipt')).toBeVisible()
    const orders = await app.mocks((mocks) => mocks.snapshot().orders.map((order) => order.status))
    expect(orders).toEqual(['confirmed'])
    expect(orderId).toMatch(/^ord_/)

    // Pedido confirmado é terminal: liquidar novamente não altera nada.
    await app.mocks((mocks) => mocks.settleOrder(document.location.pathname.split('/').pop()!))
    await expect(page.getByTestId('order-receipt')).toBeVisible()
  })

  test('assinaturas são liberadas ao sair da página', async ({ app, page }) => {
    await app.open('/nft/golden-signal-160')
    await expect.poll(() => app.mocks((mocks) => mocks.realtime.clients()[0]?.topics ?? [])).toContain('nft:golden-signal-160')
    // Navegação client-side (o socket permanece aberto): Voltar no mobile, logotipo no desktop.
    if (app.isMobile) await page.getByRole('button', { name: 'Voltar' }).click()
    else await page.getByRole('link', { name: 'Kurio, página inicial' }).click()
    await expect.poll(() => app.mocks((mocks) => mocks.realtime.clients()[0]?.topics ?? [])).not.toContain('nft:golden-signal-160')
  })
})
