import { expect, test, USERS } from './fixtures'

test.describe('Conta e sessão', () => {
  test('cadastro com validação, conflito e criação de conta', async ({ app, page }) => {
    await app.open('/cadastro')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Criar conta' }).click()
    await expect(dialog.getByText('Use pelo menos 3 caracteres')).toBeVisible()
    await expect(dialog.getByText('Informe seu e-mail')).toBeVisible()

    await dialog.getByLabel('Nome de usuário').fill('novo.colecionador')
    await dialog.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await dialog.getByLabel('Senha', { exact: true }).fill('Segura123')
    await dialog.getByLabel('Confirmar senha').fill('Segura124')
    await dialog.getByRole('button', { name: 'Criar conta' }).click()
    await expect(dialog.getByText('As senhas não conferem')).toBeVisible()

    await dialog.getByLabel('Confirmar senha').fill('Segura123')
    await dialog.getByRole('button', { name: 'Criar conta' }).click()
    // Conflito retornado pela API, associado ao campo.
    await expect(dialog.getByText('Este e-mail já está cadastrado')).toBeVisible()
    await expect(dialog.getByLabel('E-mail', { exact: true })).toHaveAttribute('aria-invalid', 'true')

    await dialog.getByLabel('E-mail', { exact: true }).fill('novo@kurio.dev')
    await dialog.getByRole('button', { name: 'Criar conta' }).click()
    await expect(dialog).toBeHidden()
    await page.goto('/perfil')
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('novo.colecionador')
    // Senha nunca é persistida em claro no banco simulado.
    const raw = await page.evaluate(() => localStorage.getItem('kurio.mock.db') ?? '')
    expect(raw).not.toContain('Segura123')
  })

  test('login inválido, retorno ao fluxo, refresh e logout', async ({ app, page }) => {
    await app.open('/perfil/carteiras')
    await expect(page).toHaveURL(/\/entrar\?redirect=/)
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await dialog.getByLabel('Senha', { exact: true }).fill('errada123')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('E-mail ou senha incorretos')

    await app.login(USERS.ana)
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
    await page.reload()
    await app.ready()
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('kurio.session'))).toBeNull()
    await page.goto('/perfil')
    await expect(page).toHaveURL(/\/entrar/)
  })

  test('expiração de sessão durante a navegação preserva o contexto', async ({ app, page }) => {
    await app.open('/entrar?redirect=/perfil')
    await app.login(USERS.ana)
    await expect(page).toHaveURL(/\/perfil$/)
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Ribeiro')
    await app.mocks((mocks) => mocks.expireSessions())
    // Próxima requisição autenticada (navegação para Carteiras) recebe 401 SESSION_EXPIRED.
    await page.getByRole('link', { name: 'Carteiras' }).first().click({ timeout: 5_000 }).catch(() => undefined)
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil(%2Fcarteiras)?&motivo=expirada/)
    const target = decodeURIComponent(new URL(page.url()).searchParams.get('redirect')!)
    await expect(page.getByRole('dialog').getByText('Sua sessão expirou. Entre novamente para continuar de onde parou.')).toBeVisible()
    await app.login(USERS.ana)
    await expect(page).toHaveURL(new RegExp(`${target}$`))
  })

  test('troca de usuário limpa dados privados da sessão anterior', async ({ app, page }) => {
    await app.open('/entrar?redirect=/perfil/favoritos')
    await app.login(USERS.ana)
    const favorites = page.getByRole('list', { name: /NFTs favoritos/ })
    await expect(favorites.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('kurio.session'))).toBeNull()
    await page.goto('/entrar?redirect=/perfil/favoritos')
    await app.login(USERS.bruno)
    await expect(page).toHaveURL(/\/perfil\/favoritos$/)
    await expect(favorites.getByRole('heading', { name: 'Golden Beat #207' })).toBeVisible()
    await expect(favorites.getByRole('heading', { name: 'Emerald Ape #042' })).toHaveCount(0)
    // O socket é recriado com a identidade da nova sessão.
    await expect.poll(() => app.mocks((mocks) => mocks.realtime.clients().map((client) => client.userId))).toEqual(['usr_bruno'])
  })
})
