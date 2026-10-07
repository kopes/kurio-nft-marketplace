import { expect, test, USERS } from './fixtures'

test.describe('Acessibilidade', () => {
  test('navegação por teclado com foco visível e link de pular conteúdo', async ({ app, page }) => {
    test.skip(app.isMobile, 'Navegação por teclado validada no viewport desktop')
    await app.open('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()

    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    await expect(focused).toBeVisible()
    const outline = await focused.evaluate((element) => getComputedStyle(element).outlineStyle)
    expect(outline).not.toBe('none')
  })

  test('diálogo de busca prende o foco, fecha com Escape e devolve o foco', async ({ app, page }) => {
    test.skip(app.isMobile, 'Busca global fica no cabeçalho desktop')
    await app.open('/')
    const trigger = page.getByRole('button', { name: 'Buscar NFTs' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Termo de busca')).toBeFocused()
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()

    await page.keyboard.press('Enter')
    await page.keyboard.type('golden')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/mercado\?q=golden/)
  })

  test('drawer de filtros no mobile gerencia o foco', async ({ app, page }) => {
    test.skip(!app.isMobile, 'Drawer existe apenas no mobile')
    await app.open('/mercado')
    await page.getByRole('button', { name: /^Filtros/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Filtros' })
    await expect(sheet).toBeVisible()
    expect(await sheet.evaluate((element) => element.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  })

  test('formulário de login: erros associados aos campos e anunciados', async ({ app, page }) => {
    await app.open('/entrar')
    const dialog = page.getByRole('dialog')
    const email = dialog.getByLabel('E-mail', { exact: true })
    // Protótipo: o login vem preenchido com a conta de demonstração; limpa para validar os erros.
    await expect(email).toHaveValue(USERS.ana.email)
    await email.fill('')
    await dialog.getByLabel('Senha', { exact: true }).fill('')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    await expect(page.locator(`#${describedBy}`)).toHaveText(/Informe seu e-mail/)
    await expect(page.locator(`#${describedBy}`)).toHaveAttribute('role', 'alert')
  })

  test('imagens relevantes possuem texto alternativo', async ({ app, page }) => {
    await app.open('/nft/emerald-ape-042')
    await expect(page.getByRole('img', { name: /Emerald Ape #042: Óculos/ })).toBeVisible()
    const missingAlt = await page.locator('img:not([alt])').count()
    expect(missingAlt).toBe(0)
  })

  test('sem overflow horizontal nas páginas principais', async ({ app, page }) => {
    await app.open('/entrar?redirect=/')
    await app.login(USERS.ana)
    for (const path of ['/', '/mercado', '/nft/emerald-ape-042', '/carrinho', '/perfil', '/perfil/carteiras']) {
      await page.goto(path)
      await app.ready()
      await page.waitForTimeout(400)
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }))
      expect(scrollWidth, path).toBeLessThanOrEqual(innerWidth)
    }
  })
})

test.describe('Carregamento e recuperação', () => {
  test('skeletons com shimmer durante carregamento lento', async ({ app, page }) => {
    await app.open('/mercado', { scenario: 'slow' })
    const grid = page.getByRole('list', { name: 'Mercado' })
    await expect(grid).toHaveAttribute('aria-busy', 'true')
    await expect(page.locator('.skeleton').filter({ visible: true }).first()).toBeVisible()
    const animation = await page.locator('.skeleton').filter({ visible: true }).first().evaluate((element) => getComputedStyle(element).animationName)
    expect(animation).toBe('shimmer')
    await expect(grid.getByRole('article').first()).toBeVisible({ timeout: 15_000 })
    await expect(grid).toHaveAttribute('aria-busy', 'false')

    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByLabel('Carregando NFT')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible({ timeout: 15_000 })
  })

  test('movimento reduzido troca o shimmer por um pulso de opacidade', async ({ app, page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await app.open('/mercado', { scenario: 'slow' })
    await expect(page.locator('.skeleton').filter({ visible: true }).first()).toBeVisible()
    const style = await page
      .locator('.skeleton')
      .filter({ visible: true })
      .first()
      .evaluate((element) => {
        const computed = getComputedStyle(element)
        return { name: computed.animationName, image: computed.backgroundImage }
      })
    // Sem movimento (nenhum brilho deslizando), mas ainda indica que está carregando.
    expect(style).toEqual({ name: 'skeleton-pulse', image: 'none' })
  })

  test('falha de conexão exibe feedback e recupera após nova tentativa', async ({ app, page }) => {
    await app.open('/mercado', { scenario: 'offline' })
    await expect(page.getByText('Não foi possível carregar o catálogo')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Sem conexão com o servidor/)).toBeVisible()
    await app.mocks((mocks) => mocks.setScenario('default'))
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByText('42 NFTs encontrados')).toBeVisible()
  })

  test('falha transitória (503) é recuperada automaticamente pelo retry', async ({ app, page }) => {
    await app.open('/mercado', { scenario: 'transient-failure' })
    await expect(page.getByText('42 NFTs encontrados')).toBeVisible({ timeout: 15_000 })
  })
})
