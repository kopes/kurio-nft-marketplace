import { expect, test } from './fixtures'

test.describe('Detalhe do NFT', () => {
  test('acesso direto, edição indisponível e limite de quantidade', async ({ app, page }) => {
    await app.open('/nft/emerald-ape-042?edicao=aberta')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Edição ABERTA, indisponível/ })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('Esta edição está indisponível para compra.').filter({ visible: true }).first()).toBeVisible()
    const buy = app.isMobile ? page.getByRole('button', { name: 'Comprar NFT' }) : page.getByRole('button', { name: 'COMPRAR' })
    await expect(buy).toBeDisabled()

    // Edição 1/10: no máximo 3 por pedido.
    await page.getByRole('radio', { name: /Edição 1\/10/ }).click()
    await expect(page).toHaveURL(/edicao=1-10/)
    const scope = app.isMobile ? page.getByTestId('purchase-bar') : page.locator('#conteudo')
    const increase = scope.getByRole('button', { name: /^Aumentar quantidade/ }).first()
    await increase.click()
    await increase.click()
    await expect(increase).toBeDisabled()
    await expect(scope.locator('output').first()).toHaveText('3')
    await expect(buy).toBeEnabled()

    // Zoom acessível (diálogo com foco gerenciado).
    await page.getByRole('button', { name: 'Ampliar imagem' }).click()
    await expect(page.getByRole('dialog', { name: 'Emerald Ape #042 ampliado' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('NFT inexistente exibe 404 sem quebrar a aplicação', async ({ app, page }) => {
    await app.open('/nft/nao-existe-999')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Explorar o mercado' }).click()
    await expect(page).toHaveURL(/\/mercado$/)
  })

  test('rota inexistente exibe página 404', async ({ app, page }) => {
    await app.open('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('falha de servidor exibe erro e permite nova tentativa', async ({ app, page }) => {
    await app.open('/nft/emerald-ape-042', { scenario: 'server-error' })
    await expect(page.getByText('Não foi possível carregar este NFT')).toBeVisible({ timeout: 15_000 })
    await app.mocks((mocks) => mocks.setScenario('default'))
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  })
})
