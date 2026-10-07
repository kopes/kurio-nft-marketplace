import { expect, test, USERS } from './fixtures'

test.describe('Carrinho', () => {
  test('quantidades, remoção, cupom e persistência após refresh', async ({ app, page }) => {
    await app.open('/')
    await app.addToCart('emerald-ape-042', { quantity: 2 })
    await app.addToCart('golden-signal-160')
    await page.goto('/carrinho')

    await expect(app.cartItems()).toHaveCount(2)
    const emerald = app.cartItems().filter({ hasText: 'Emerald Ape #042' })
    await expect(emerald.getByText('2.38 ETH').filter({ visible: true }).first()).toBeVisible()

    // Resumo calculado pela API: 1.19*2 + 0.39 = 2.77; taxa 0.016 => 2.786
    const summary = page.getByRole('complementary', { name: 'Resumo da carteira' })
    await expect(summary.getByText('2.77 ETH')).toBeVisible()
    await expect(summary.getByText('2.786 ETH')).toBeVisible()

    // Alteração otimista de quantidade com confirmação da API.
    await emerald.getByRole('button', { name: /^Aumentar quantidade/ }).first().click()
    await expect(emerald.getByText('3.57 ETH').filter({ visible: true }).first()).toBeVisible()
    await expect(summary.getByText('3.976 ETH')).toBeVisible()
    await expect(app.liveRegion()).toContainText('Quantidade de Emerald Ape #042 atualizada para 3')

    // Cupom inválido, expirado e válido.
    const coupon = summary.getByLabel('Código promocional')
    await coupon.fill('NAOEXISTE')
    await summary.getByRole('button', { name: 'Aplicar' }).click()
    await expect(summary.getByRole('alert')).toContainText('Código promocional inválido')
    await coupon.fill('VERAO25')
    await summary.getByRole('button', { name: 'Aplicar' }).click()
    await expect(summary.getByRole('alert')).toContainText('Código promocional expirado')
    await coupon.fill('KURIO10')
    await summary.getByRole('button', { name: 'Aplicar' }).click()
    await expect(summary.getByText('KURIO10', { exact: true })).toBeVisible()
    // 10% de 3.96 = 0.396 => total 3.96 - 0.396 + 0.016 = 3.58
    await expect(summary.getByText('(-) 0.396 ETH')).toBeVisible()
    await expect(summary.getByText('3.58 ETH')).toBeVisible()

    // Remoção.
    await app.cartItems().filter({ hasText: 'Golden Signal #160' }).getByRole('button', { name: /^Remover Golden Signal/ }).first().click()
    await expect(app.cartItems()).toHaveCount(1)

    // Persistência após refresh (carrinho de visitante na API simulada).
    await page.reload()
    await app.ready()
    await expect(app.cartItems()).toHaveCount(1)
    await expect(summary.getByText('KURIO10', { exact: true })).toBeVisible()

    await summary.getByRole('button', { name: 'Remover' }).click()
    await expect(summary.getByLabel('Código promocional')).toBeVisible()
  })

  test('itens do visitante são preservados ao autenticar', async ({ app, page }) => {
    await app.open('/')
    await app.addToCart('violet-nomad-314')
    await page.goto('/carrinho')
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)
    await app.login(USERS.ana)
    await expect(page).toHaveURL(/\/pagamento$/)
    await expect(page.getByRole('complementary', { name: 'Seus NFTs' }).getByText('Violet Nomad #314')).toBeVisible()
    await page.reload()
    await app.ready()
    await expect(page.getByRole('complementary', { name: 'Seus NFTs' }).getByText('Violet Nomad #314')).toBeVisible()
  })

  test('limite por edição é respeitado pela API', async ({ app, page }) => {
    await app.open('/')
    await app.addToCart('emerald-ape-042', { edition: '1-10', quantity: 3 })
    await page.goto('/nft/emerald-ape-042?edicao=1-10')
    if (app.isMobile) await page.getByRole('button', { name: 'Adicionar Emerald Ape #042 ao carrinho' }).click()
    else await page.getByRole('button', { name: 'COMPRAR' }).click()
    await expect(page.getByTestId('live-assertive')).toContainText('Limite de 3 unidade(s) por pedido')
  })
})
