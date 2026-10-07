import { expect, goToCheckout, openReview, test } from './fixtures'

test.describe('Falhas de pagamento e idempotência', () => {
  test('pagamento recusado preserva o carrinho e permite nova tentativa', async ({ app, page }) => {
    await goToCheckout(app, page, ['golden-signal-160'], 'payment-declined')
    const review = await openReview(page)
    await review.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Pagamento recusado pela carteira/)).toBeVisible()
    // Nenhum recibo para pedido recusado; itens continuam no carrinho.
    await expect(page.getByTestId('order-receipt')).toHaveCount(0)
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(app.cartItems()).toHaveCount(1)

    await app.mocks((mocks) => mocks.setScenario('default'))
    await page.goto('/pagamento')
    const retry = await openReview(page)
    await retry.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(page.getByTestId('order-receipt')).toBeVisible({ timeout: 15_000 })
    const orders = await app.mocks((mocks) => mocks.snapshot().orders.map((order) => order.status))
    expect(orders.sort()).toEqual(['confirmed', 'declined'])
  })

  test('cliques repetidos não duplicam o pedido', async ({ app, page }) => {
    await goToCheckout(app, page, ['golden-signal-160'])
    const review = await openReview(page)
    const confirm = review.getByRole('button', { name: 'Confirmar e pagar' })
    // Três cliques no mesmo frame, antes de o React desabilitar o botão.
    await confirm.evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
      button.click()
    })
    await expect(page).toHaveURL(/\/pedido\/ord_/)
    const orders = await app.mocks((mocks) => mocks.snapshot().orders)
    expect(orders).toHaveLength(1)
  })

  test('timeout após criação recupera o mesmo pedido pela chave de idempotência', async ({ app, page }) => {
    await goToCheckout(app, page, ['golden-signal-160'], 'order-timeout')
    const keys: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/orders')) keys.push(request.headers()['idempotency-key'])
    })
    const review = await openReview(page)
    await review.getByRole('button', { name: 'Confirmar e pagar' }).click()
    // A primeira resposta excede o timeout do cliente (8 s); a nova tentativa usa a mesma chave.
    await expect(page).toHaveURL(/\/pedido\/ord_0001/, { timeout: 25_000 })
    expect(keys.length).toBeGreaterThanOrEqual(2)
    expect(new Set(keys).size).toBe(1)
    const orders = await app.mocks((mocks) => mocks.snapshot().orders)
    expect(orders).toHaveLength(1)
    await expect(page.getByTestId('order-receipt')).toBeVisible({ timeout: 15_000 })
  })

  test('carteira recusa a conexão e o usuário tenta novamente', async ({ app, page }) => {
    await goToCheckout(app, page, ['golden-signal-160'], 'wallet-rejected')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.locator('#conteudo').getByText(/A conexão foi recusada na carteira/)).toBeVisible()
    await expect(page.getByRole('dialog')).toBeHidden()
    const review = await openReview(page)
    await expect(review.getByText('Carteira conectada')).toBeVisible()
    // Desconexão: a confirmação exige reconectar.
    await review.getByRole('button', { name: 'Voltar e editar' }).click()
    await page.getByRole('button', { name: 'Desconectar' }).click()
    await expect(page.getByText('Carteira não conectada')).toBeVisible()
  })

  test('edição esgotada durante a compra bloqueia a confirmação', async ({ app, page }) => {
    await goToCheckout(app, page, ['golden-signal-160'], 'sold-out')
    const review = await openReview(page)
    await review.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(review.getByText(/não estão mais disponíveis/)).toBeVisible()
    await expect(review.getByRole('button', { name: 'Confirmar e pagar' })).toBeDisabled()
    expect(await app.mocks((mocks) => mocks.snapshot().orders)).toHaveLength(0)
  })
})
