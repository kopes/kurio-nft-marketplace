import type { Page } from '@playwright/test'
import { expect, test, type App } from './fixtures'

const grid = (page: Page) => page.getByRole('list', { name: 'Mercado' })
const cardTitles = (page: Page) => grid(page).getByRole('heading', { level: 3 })

async function cardPrices(page: Page) {
  // Primeiro preço de cada card (o preço anterior riscado vem depois).
  const texts = await grid(page).getByRole('article').locator('span.tabular-nums:not(s *)').allTextContents()
  return texts.map((text) => Number(text.replace(/[^\d.]/g, '')))
}

/** Alterna um filtro de faceta (sidebar no desktop, sheet no mobile). */
async function toggleFacet(app: App, label: string) {
  const { page } = app
  if (app.isMobile) {
    await page.getByRole('button', { name: /^Filtros/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Filtros' })
    await sheet.getByRole('button', { name: new RegExp(`^${label} \\(`) }).click()
    await sheet.getByRole('button', { name: 'Ver resultados' }).click()
    await expect(sheet).toBeHidden()
  } else {
    await page.getByRole('button', { name: new RegExp(`^${label} \\(`) }).click()
  }
}

/** Ordenação: select no desktop; no mobile fica no drawer de filtros (o frame mobile não a exibe na tela). */
async function chooseSort(app: App, label: string) {
  const { page } = app
  if (app.isMobile) {
    await page.getByRole('button', { name: /^Filtros/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Filtros' })
    await sheet.getByRole('radio', { name: label }).click()
    await sheet.getByRole('button', { name: 'Ver resultados' }).click()
    await expect(sheet).toBeHidden()
  } else {
    await page.getByRole('combobox', { name: 'Ordenar por:' }).click()
    await page.getByRole('option', { name: label }).click()
  }
}

async function expectSort(app: App, label: string) {
  const { page } = app
  if (app.isMobile) {
    await page.getByRole('button', { name: /^Filtros/ }).click()
    await expect(page.getByRole('dialog', { name: 'Filtros' }).getByRole('radio', { name: label })).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')
  } else {
    await expect(page.getByRole('combobox', { name: 'Ordenar por:' })).toHaveText(new RegExp(label))
  }
}

test.describe('Catálogo', () => {
  test('busca, filtros combinados, ordenação e paginação compõem a URL e sobrevivem ao histórico', async ({ app, page }) => {
    await app.open('/mercado')
    await expect(page.getByText('42 NFTs encontrados')).toBeVisible()

    // Busca (com debounce) reflete na URL e nos resultados.
    await page.getByRole('searchbox', { name: 'Buscar NFTs no catálogo' }).fill('golden')
    await expect(page).toHaveURL(/q=golden/)
    await expect(page.getByText(/NFTs? encontrados?/)).not.toHaveText('42 NFTs encontrados')
    for (const title of await cardTitles(page).allTextContents()) expect(title.toLowerCase()).toContain('golden')
    // Chips de filtro existem a partir do tablet; no mobile a busca é limpa no próprio campo.
    if (app.isMobile) await page.getByRole('searchbox', { name: 'Buscar NFTs no catálogo' }).fill('')
    else await page.getByRole('button', { name: /Remover filtro Busca/ }).click()
    await expect(page.getByText('42 NFTs encontrados')).toBeVisible()

    // Paginação
    const firstPageTitles = await cardTitles(page).allTextContents()
    await page.getByRole('button', { name: 'Página 2', exact: true }).click()
    await expect(page).toHaveURL(/pagina=2/)
    await expect(cardTitles(page).first()).not.toHaveText(firstPageTitles[0])

    // Filtro reinicia a paginação; filtros são combináveis.
    await toggleFacet(app, 'Música')
    await expect(page).not.toHaveURL(/pagina=/)
    await expect(page).toHaveURL(/colecoes=musica/)
    const onlyMusic = await page.getByText(/NFTs? encontrados?/).textContent()
    await toggleFacet(app, 'Solana')
    await expect(page).toHaveURL(/colecoes=musica.*redes=solana|redes=solana.*colecoes=musica/)
    await expect(page.getByText(/NFTs? encontrados?/)).not.toHaveText(onlyMusic!)

    // Ordenação por menor preço.
    await toggleFacet(app, 'Solana')
    await chooseSort(app, 'Menor preço')
    await expect(page).toHaveURL(/ordem=menor-preco/)
    await expect(async () => {
      const prices = await cardPrices(page)
      expect(prices.length).toBeGreaterThan(1)
      expect([...prices].sort((a, b) => a - b)).toEqual(prices)
    }).toPass()

    // Refresh mantém o estado.
    await page.reload()
    await app.ready()
    await expect(page).toHaveURL(/ordem=menor-preco/)
    await expectSort(app, 'Menor preço')

    // Voltar no histórico restaura o estado anterior (sem ordenação).
    await page.goBack()
    await expect(page).not.toHaveURL(/ordem=/)
    await expect(page).toHaveURL(/colecoes=musica/)
    await page.goBack()
    await expect(page).toHaveURL(/redes=solana/)
  })

  test('URL com parâmetros inválidos é saneada e resultado vazio é tratado', async ({ app, page }) => {
    await app.open('/mercado?pagina=abc&ordem=xyz&colecoes=inexistente')
    await expect(page.getByText('42 NFTs encontrados')).toBeVisible()
    await app.open('/mercado?q=zzzz-sem-resultado')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page.getByText('42 NFTs encontrados')).toBeVisible()
  })

  test('catálogo vazio no cenário "empty"', async ({ app, page }) => {
    await app.open('/', { scenario: 'empty' })
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
  })

  test('respostas fora de ordem não sobrescrevem a busca mais recente', async ({ app, page }) => {
    await app.open('/mercado', { scenario: 'variable-latency' })
    const search = page.getByRole('searchbox', { name: 'Buscar NFTs no catálogo' })
    // Cada termo é confirmado (debounce de 350 ms) e gera uma requisição com latência própria.
    for (const term of ['s', 'so', 'sol', 'sola', 'solar']) {
      await search.fill(term)
      await page.waitForTimeout(420)
    }
    await expect(page).toHaveURL(/q=solar/)
    await expect(async () => {
      const titles = await cardTitles(page).allTextContents()
      expect(titles.length).toBeGreaterThan(0)
      for (const title of titles) expect(title.toLowerCase()).toContain('solar')
    }).toPass({ timeout: 8_000 })
    // Aguarda as respostas atrasadas das buscas anteriores: o resultado permanece o da última.
    await page.waitForTimeout(2_500)
    for (const title of await cardTitles(page).allTextContents()) expect(title.toLowerCase()).toContain('solar')
  })
})
