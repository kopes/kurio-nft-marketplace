import { expect, goToCheckout, openCheckoutDetails, openReview, test, USERS } from './fixtures'

test.describe('Compra', () => {
  test('compra completa do catálogo ao recibo confirmado', async ({ app, page }) => {
    await app.open('/entrar?redirect=/')
    await app.login(USERS.ana)

    // Catálogo -> detalhe -> carrinho
    await page.goto('/mercado?q=golden%20signal%20%23160')
    await page.getByRole('link', { name: 'Golden Signal #160' }).click()
    await expect(page).toHaveURL(/\/nft\/golden-signal-160/)
    if (app.isMobile) await page.getByRole('button', { name: 'Comprar NFT' }).click()
    else await page.getByRole('button', { name: 'COMPRAR' }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/pagamento$/)

    // Validação dos campos do layout (no mobile ficam na folha "Dados do pagamento", que reabre com os erros).
    const details = page.getByRole('dialog', { name: 'Dados do pagamento' })
    if (app.isMobile) await openCheckoutDetails(page)
    await page.getByLabel('Código de indicação').fill('')
    await page.getByLabel('Nome de usuário').fill('a')
    if (app.isMobile) await details.getByRole('button', { name: 'Fechar' }).click()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByText('Informe o código de indicação')).toBeVisible()
    await expect(page.getByText('Use pelo menos 3 caracteres')).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Revise seu pedido' })).toBeHidden()
    await page.getByLabel('Código de indicação').fill('KURIO-ANA')
    await page.getByLabel('Nome de usuário').fill('ana.coleciona')
    if (app.isMobile) {
      await details.getByRole('button', { name: 'Concluir' }).click()
      await expect(details).toBeHidden()
    }

    // Revisão antes do envio (inclui conexão simulada da carteira).
    const review = await openReview(page)
    await expect(review.getByText('Golden Signal #160')).toBeVisible()
    await expect(review.getByText('0.406 ETH')).toBeVisible()
    await expect(review.getByText('Carteira conectada')).toBeVisible()
    await review.getByRole('button', { name: 'Confirmar e pagar' }).click()

    // Pedido pendente -> confirmado (simulação), recibo com snapshot.
    await expect(page).toHaveURL(/\/pedido\/ord_\d+/)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await expect(page.getByTestId('order-receipt')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    await expect(page.getByTestId('order-receipt').getByText('0.406 ETH').first()).toBeVisible()

    // Recibo é um snapshot: mudanças posteriores no catálogo não alteram os valores.
    await app.mocks((mocks) => mocks.changePrice('golden-signal-160', '9.99'))
    await page.reload()
    await app.ready()
    await expect(page.getByTestId('order-receipt').getByText('0.39 ETH').first()).toBeVisible()

    // Carrinho sem os itens comprados; estoque baixado na API.
    await page.goto('/carrinho')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
    const editions = await app.mocks((mocks) => mocks.getNft('golden-signal-160').editions)
    expect(editions.find((edition) => edition.id === '1-50')?.available).toBe(16)
  })

  test('apenas itens e quantidades comprados saem do carrinho', async ({ app, page }) => {
    await goToCheckout(app, page, ['golden-signal-160'])
    const review = await openReview(page)
    await review.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const orderUrl = page.url()
    // Item adicionado enquanto o pedido está pendente não faz parte da compra.
    await app.addToCart('violet-nomad-314')
    await page.goto(orderUrl)
    await expect(page.getByTestId('order-receipt')).toBeVisible({ timeout: 15_000 })
    await page.goto('/carrinho')
    await expect(app.cartItems()).toHaveCount(1)
    await expect(app.cartItems().first()).toContainText('Violet Nomad #314')
  })

  test('acesso direto ao recibo de outro usuário é negado', async ({ app, page }) => {
    await goToCheckout(app, page, ['golden-signal-160'])
    const review = await openReview(page)
    await review.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(page).toHaveURL(/\/pedido\/ord_\d+/)
    const url = page.url()
    await page.evaluate(() => localStorage.removeItem('kurio.session'))
    await page.goto('/entrar')
    await app.login(USERS.bruno)
    await page.goto(url)
    await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible()
  })
})
