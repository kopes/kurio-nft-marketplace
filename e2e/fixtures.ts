import { test as base, expect, type Page } from '@playwright/test'

/** Subconjunto tipado de window.__KURIO_MOCKS__ (src/mocks/controls.ts) usado nos testes. */
export interface MockControls {
  setScenario(id: ScenarioId): void
  setOffline(offline: boolean): void
  reset(): Promise<void>
  changePrice(nftId: string, price?: string, options?: { silent?: boolean }): { id: string | null; version: number }
  setAvailability(nftId: string, editionId: string, available: number): { id: string }
  expireSessions(): void
  settleOrder(orderId: string): void
  getNft(nftId: string): { price: string; version: number; editions: Array<{ id: string; available: number; status: string }> }
  realtime: {
    drop(): void
    replayLast(type?: string): { id: string } | null
    emitStale(nftId: string, price?: string): { id: string; version: number }
    clients(): Array<{ id: string; userId: string | null; topics: string[] }>
  }
  snapshot(): { orders: Array<{ id: string; status: string; idempotencyKey: string; items: Array<{ nftId: string; quantity: number }> }>; carts: Record<string, { items: Array<{ nftId: string; quantity: number }> }> }
}

declare global {
  interface Window {
    __KURIO_MOCKS__?: MockControls
  }
}

export type ScenarioId =
  | 'default'
  | 'empty'
  | 'slow'
  | 'variable-latency'
  | 'offline'
  | 'server-error'
  | 'transient-failure'
  | 'session-expired'
  | 'forbidden'
  | 'favorites-failure'
  | 'wallet-rejected'
  | 'price-change'
  | 'sold-out'
  | 'order-timeout'
  | 'payment-declined'
  | 'payment-pending'

export const USERS = {
  ana: { email: 'ana@kurio.dev', password: 'Kurio2026', name: 'Ana Ribeiro' },
  bruno: { email: 'bruno@kurio.dev', password: 'Kurio2026', name: 'Bruno Lima' },
} as const

interface OpenOptions {
  scenario?: ScenarioId
}

/** Utilitários de alto nível sobre a aplicação e a API simulada (via window.__KURIO_MOCKS__). */
export class App {
  constructor(readonly page: Page) {}

  get isMobile() {
    return (this.page.viewportSize()?.width ?? 1440) < 768
  }

  async open(path = '/', { scenario = 'default' }: OpenOptions = {}) {
    // Define o cenário apenas no primeiro carregamento da aba; recargas preservam mudanças feitas no teste.
    await this.page.addInitScript((id) => {
      localStorage.setItem('kurio.mock.panel', 'hidden')
      if (!sessionStorage.getItem('kurio.e2e.init')) {
        sessionStorage.setItem('kurio.e2e.init', '1')
        localStorage.setItem('kurio.mock.settings', JSON.stringify({ scenario: id, offline: false }))
      }
    }, scenario)
    await this.page.goto(path)
    await this.ready()
  }

  async ready() {
    await this.page.waitForFunction(() => Boolean(window.__KURIO_MOCKS__))
  }

  /** Executa uma ação na API simulada (mesma camada usada pelo painel de cenários). */
  mocks<T>(fn: (mocks: MockControls) => T | Promise<T>): Promise<T> {
    return this.page.evaluate(`(${fn.toString()})(window.__KURIO_MOCKS__)`) as Promise<T>
  }

  async login(user: { email: string; password: string }, path = '/entrar') {
    if (!this.page.url().includes('/entrar')) await this.page.goto(path)
    const dialog = this.page.getByRole('dialog')
    await dialog.getByLabel('E-mail', { exact: true }).fill(user.email)
    await dialog.getByLabel('Senha', { exact: true }).fill(user.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog).toBeHidden()
  }

  /** Adiciona um NFT ao carrinho pela página de detalhe (sem navegar para o carrinho). */
  async addToCart(nftId: string, { quantity = 1, edition }: { quantity?: number; edition?: string } = {}) {
    await this.page.goto(`/nft/${nftId}${edition ? `?edicao=${edition}` : ''}`)
    const name = await this.page.getByRole('heading', { level: 1 }).textContent()
    const scope = this.isMobile ? this.page.getByTestId('purchase-bar') : this.page.locator('#conteudo')
    for (let i = 1; i < quantity; i++) await scope.getByRole('button', { name: /^Aumentar quantidade/ }).first().click()
    if (this.isMobile) await this.page.getByRole('button', { name: `Adicionar ${name} ao carrinho` }).click()
    else await this.page.getByRole('button', { name: 'COMPRAR' }).click()
    await expect(this.page.getByText(/adicionado ao carrinho/).first()).toBeVisible()
  }

  cartItems() {
    return this.page.getByTestId('cart-item')
  }

  liveRegion() {
    return this.page.getByTestId('live-polite')
  }
}

export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    await use(new App(page))
  },
})

export async function goToCheckout(app: App, page: Page, nftIds: string[] = ['emerald-ape-042'], scenario: ScenarioId = 'default') {
  await app.open('/entrar?redirect=/', { scenario })
  await app.login(USERS.ana)
  for (const id of nftIds) await app.addToCart(id)
  await page.goto('/pagamento')
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  // Dados pré-preenchidos a partir do perfil e da carteira principal cadastrada.
  await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Ribeiro')
  await expect(page.getByRole('radio', { name: /Principal/ })).toHaveAttribute('aria-checked', 'true')
}

export async function openReview(page: Page) {
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revise seu pedido' })
  await expect(dialog).toBeVisible()
  return dialog
}

export { expect }
