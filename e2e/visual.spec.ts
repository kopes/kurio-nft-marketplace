import { expect, test, USERS } from './fixtures'

/**
 * Regressão visual com dados estáveis: fixtures determinísticas, cenário padrão,
 * relógio fixo, animações desativadas e painel de cenários oculto.
 */
test.describe('Regressão visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-20T15:00:00-03:00') })
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  test('início', async ({ app, page }) => {
    await app.open('/')
    await expect(page.getByText('42 NFTs encontrados')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
  })

  test('detalhe do NFT', async ({ app, page }) => {
    await app.open('/nft/emerald-ape-042')
    await expect(page.locator('section[aria-labelledby="related-title"] article').first()).toBeVisible()
    await page.waitForTimeout(500)
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
  })

  test('carrinho', async ({ app, page }) => {
    await app.open('/')
    await app.addToCart('emerald-ape-042', { quantity: 2 })
    await app.addToCart('violet-nomad-314')
    await page.goto('/carrinho')
    await expect(page.getByText('3.786 ETH')).toBeVisible()
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true, mask: [page.locator('[data-sonner-toaster]')] })
  })

  test('pagamento', async ({ app, page }) => {
    await app.open('/entrar?redirect=/')
    await app.login(USERS.ana)
    await app.addToCart('emerald-ape-042')
    await page.goto('/pagamento')
    // No mobile os campos ficam na folha "Dados do pagamento" (fora do frame); a carteira principal vem selecionada.
    if (app.isMobile) await expect(page.getByRole('radio', { name: /Principal/ })).toHaveAttribute('aria-checked', 'true')
    else await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Ribeiro')
    await expect(page.getByText('1.206 ETH')).toBeVisible()
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true, mask: [page.locator('[data-sonner-toaster]')] })
  })
})
