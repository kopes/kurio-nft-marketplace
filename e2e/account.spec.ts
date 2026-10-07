import { expect, test, USERS } from './fixtures'

// PNG 1x1 válido para o upload de avatar.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test.describe('Perfil e carteiras', () => {
  test('edição de perfil com erros de validação e da API, persistida após refresh', async ({ app, page }) => {
    await app.open('/entrar?redirect=/perfil')
    await app.login(USERS.ana)
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Ribeiro')

    await page.getByLabel('Nome de exibição').fill('A')
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('email-invalido')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Informe o nome de exibição')).toBeVisible()
    await expect(page.getByText('Informe um e-mail válido')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'E-mail', exact: true })).toHaveAttribute('aria-describedby', /error/)

    await page.getByLabel('Nome de exibição').fill('Ana Ribeiro Lima')
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Nome de usuário').fill('bruno.nft')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Este nome de usuário já está em uso')).toBeVisible()

    await page.getByLabel('Nome de usuário').fill('ana.lima')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(app.liveRegion()).toContainText('Perfil atualizado')
    await page.reload()
    await app.ready()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Ribeiro Lima')
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('ana.lima')
  })

  test('avatar: envio, validação de formato e remoção', async ({ app, page }) => {
    await app.open('/entrar?redirect=/perfil')
    await app.login(USERS.ana)
    const fileInput = page.locator('input[type=file]')
    await fileInput.setInputFiles({ name: 'avatar.gif', mimeType: 'image/gif', buffer: PNG })
    await expect(page.getByText('Use uma imagem PNG, JPG ou WebP.')).toBeVisible()
    await fileInput.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByRole('img', { name: 'Avatar atual' })).toBeVisible()
    await page.reload()
    await app.ready()
    await expect(page.getByRole('img', { name: 'Avatar atual' })).toBeVisible()
    await page.getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByRole('img', { name: 'Avatar atual' })).toHaveCount(0)
  })

  test('alteração de senha com senha atual incorreta e sucesso', async ({ app, page }) => {
    await app.open('/entrar?redirect=/perfil')
    await app.login(USERS.ana)
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Ribeiro')
    await page.getByLabel('Senha atual', { exact: true }).fill('errada000')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha1')
    await page.getByLabel('Confirmar nova senha', { exact: true }).fill('NovaSenha2')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('As senhas não conferem')).toBeVisible()
    await page.getByLabel('Confirmar nova senha', { exact: true }).fill('NovaSenha1')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Senha atual incorreta')).toBeVisible()
    await page.getByLabel('Senha atual', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(app.liveRegion()).toContainText('Senha alterada com sucesso')

    // A nova senha passa a valer no login.
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('kurio.session'))).toBeNull()
    await page.goto('/entrar')
    await app.login({ email: USERS.ana.email, password: 'NovaSenha1' })
  })

  test('carteiras: validação de endereço, edição e cadastro da secundária', async ({ app, page }) => {
    await app.open('/entrar?redirect=/perfil/carteiras')
    await app.login(USERS.bruno)
    await expect(page.getByText('Você ainda não adicionou uma carteira principal.')).toBeVisible()
    await page.getByRole('button', { name: 'Adicionar' }).first().click()

    const primary = page.getByTestId('wallet-form-principal')
    await primary.getByLabel('Apelido da carteira').fill('Cofre')
    await primary.getByLabel('Nome do perfil').fill('Bruno Coleciona')
    await primary.getByLabel('Endereço da carteira').fill('0x123')
    await primary.getByLabel('Código de indicação').fill('BRUNO-01')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText('Endereço inválido: use 0x seguido de 40 caracteres hexadecimais')).toBeVisible()

    await primary.getByLabel('Endereço da carteira').fill('0x1111111111111111111111111111111111111111')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(app.liveRegion()).toContainText('Carteira principal salva')

    // Secundária igual à principal.
    await page.getByText('Igual à carteira principal').click()
    const secondary = page.getByTestId('wallet-form-secundaria')
    await expect(secondary.getByLabel('Endereço da carteira')).toHaveValue('0x1111111111111111111111111111111111111111')
    await secondary.getByLabel('Apelido da carteira').fill('Reserva')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(app.liveRegion()).toContainText('Carteira secundária salva')

    await page.reload()
    await app.ready()
    await expect(page.getByTestId('wallet-form-principal').getByLabel('Apelido da carteira')).toHaveValue('Cofre')
    await expect(page.getByTestId('wallet-form-secundaria').getByLabel('Apelido da carteira')).toHaveValue('Reserva')
  })

  test('acesso não autorizado (403) é tratado na interface', async ({ app, page }) => {
    await app.open('/entrar?redirect=/perfil/carteiras', { scenario: 'forbidden' })
    await app.login(USERS.ana)
    await expect(page.getByText('Você não tem permissão para acessar este recurso.')).toBeVisible()
  })
})
