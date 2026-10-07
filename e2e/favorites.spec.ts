import { expect, test, USERS } from './fixtures'

const favoriteToggle = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^Favoritar/ }).first()

test.describe('Favoritos', () => {
  test('visitante é levado ao login ao favoritar', async ({ app, page }) => {
    await app.open('/nft/golden-signal-160')
    await favoriteToggle(page).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fnft%2Fgolden-signal-160/)
  })

  test('favorito otimista persiste para o usuário autenticado', async ({ app, page }) => {
    await app.open('/entrar?redirect=/nft/golden-signal-160')
    await app.login(USERS.ana)
    await expect(page.getByRole('heading', { level: 1, name: 'Golden Signal #160' })).toBeVisible()
    await expect(favoriteToggle(page)).toHaveAttribute('aria-pressed', 'false')
    await favoriteToggle(page).click()
    await expect(favoriteToggle(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(app.liveRegion()).toContainText('adicionado aos favoritos')
    await page.reload()
    await app.ready()
    await expect(favoriteToggle(page)).toHaveAttribute('aria-pressed', 'true')
  })

  test('falha da mutation reverte o estado (rollback) e informa o usuário', async ({ app, page }) => {
    await app.open('/entrar?redirect=/nft/golden-signal-160', { scenario: 'favorites-failure' })
    await app.login(USERS.ana)
    await expect(page.getByRole('heading', { level: 1, name: 'Golden Signal #160' })).toBeVisible()
    await favoriteToggle(page).click()
    await expect(page.getByTestId('live-assertive')).toContainText('Não foi possível atualizar Golden Signal #160 nos favoritos')
    await expect(favoriteToggle(page)).toHaveAttribute('aria-pressed', 'false')
    // Recuperação: com a API normalizada, a mesma ação funciona.
    await app.mocks((mocks) => mocks.setScenario('default'))
    await favoriteToggle(page).click()
    await expect(favoriteToggle(page)).toHaveAttribute('aria-pressed', 'true')
  })
})
