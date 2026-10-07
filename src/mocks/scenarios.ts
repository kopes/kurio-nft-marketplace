/**
 * Cenários determinísticos da API simulada.
 *
 * Um cenário define latência, falhas HTTP/de conexão e desvios de regra de negócio.
 * Seleção: `?scenario=<id>` na URL (persistido), painel "Cenários" na interface ou
 * `window.__KURIO_MOCKS__.setScenario(id)` (usado pelos testes Playwright).
 */

export type LatencyProfile =
  | { kind: 'fixed'; ms: number }
  /** Latência variável, porém reproduzível: derivada do hash da URL e do contador de requisições. */
  | { kind: 'variable'; min: number; max: number }

export interface FailureRule {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | '*'
  path: RegExp
  status: number
  code: string
  message: string
  /** Falha apenas nas N primeiras tentativas de cada URL (falha transitória). */
  times?: number
  /** Em vez de resposta HTTP, simula queda de conexão. */
  networkError?: boolean
}

export interface ScenarioDefinition {
  id: ScenarioId
  label: string
  description: string
  latency: { read: LatencyProfile; write: LatencyProfile }
  offline?: boolean
  failures?: FailureRule[]
  catalogEmpty?: boolean
  sessionTtlMs?: number
  priceChangeOnCheckout?: boolean
  soldOutOnCheckout?: boolean
  orderTimeout?: boolean
  walletRejected?: boolean
  payment: { outcome: 'confirm' | 'decline'; delayMs: number }
}

export const scenarioIds = [
  'default',
  'empty',
  'slow',
  'variable-latency',
  'offline',
  'server-error',
  'transient-failure',
  'session-expired',
  'forbidden',
  'favorites-failure',
  'wallet-rejected',
  'price-change',
  'sold-out',
  'order-timeout',
  'payment-declined',
  'payment-pending',
] as const
export type ScenarioId = (typeof scenarioIds)[number]

const normal = { read: { kind: 'fixed', ms: 180 }, write: { kind: 'fixed', ms: 260 } } as const
const confirm = { outcome: 'confirm', delayMs: 2500 } as const

export const scenarios: Record<ScenarioId, ScenarioDefinition> = {
  default: {
    id: 'default',
    label: 'Padrão (sucesso)',
    description: 'Latência estável e todas as operações bem-sucedidas.',
    latency: normal,
    payment: confirm,
  },
  empty: {
    id: 'empty',
    label: 'Catálogo vazio',
    description: 'A listagem de NFTs retorna zero resultados.',
    latency: normal,
    catalogEmpty: true,
    payment: confirm,
  },
  slow: {
    id: 'slow',
    label: 'Rede lenta',
    description: 'Leituras levam 2,5 s e escritas 1,2 s (skeletons visíveis).',
    latency: { read: { kind: 'fixed', ms: 2500 }, write: { kind: 'fixed', ms: 1200 } },
    payment: { outcome: 'confirm', delayMs: 4000 },
  },
  'variable-latency': {
    id: 'variable-latency',
    label: 'Latência variável',
    description: 'Cada URL tem latência própria (80 ms a 2,4 s): respostas chegam fora de ordem.',
    latency: { read: { kind: 'variable', min: 80, max: 2400 }, write: { kind: 'variable', min: 150, max: 900 } },
    payment: confirm,
  },
  offline: {
    id: 'offline',
    label: 'Sem conexão',
    description: 'Todas as requisições falham por indisponibilidade de rede.',
    latency: normal,
    offline: true,
    payment: confirm,
  },
  'server-error': {
    id: 'server-error',
    label: 'Erro 500 no catálogo',
    description: 'Listagem e detalhe de NFTs respondem HTTP 500.',
    latency: normal,
    failures: [
      { method: 'GET', path: /^\/api\/nfts/, status: 500, code: 'INTERNAL_ERROR', message: 'Erro interno ao consultar o catálogo.' },
    ],
    payment: confirm,
  },
  'transient-failure': {
    id: 'transient-failure',
    label: 'Falha transitória (503)',
    description: 'A primeira tentativa de cada leitura responde 503; a nova tentativa funciona.',
    latency: normal,
    failures: [
      {
        method: 'GET',
        path: /^\/api\//,
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Serviço temporariamente indisponível.',
        times: 1,
      },
    ],
    payment: confirm,
  },
  'session-expired': {
    id: 'session-expired',
    label: 'Sessão expira em 45 s',
    description: 'Sessões criadas neste cenário expiram 45 segundos após o login.',
    latency: normal,
    sessionTtlMs: 45_000,
    payment: confirm,
  },
  forbidden: {
    id: 'forbidden',
    label: 'Acesso não autorizado (403)',
    description: 'Perfil e carteiras respondem 403 mesmo com sessão válida.',
    latency: normal,
    failures: [
      { method: '*', path: /^\/api\/(profile|wallets)/, status: 403, code: 'FORBIDDEN', message: 'Você não tem permissão para acessar este recurso.' },
    ],
    payment: confirm,
  },
  'favorites-failure': {
    id: 'favorites-failure',
    label: 'Falha ao favoritar',
    description: 'Inclusão e remoção de favoritos respondem 500 (rollback otimista).',
    latency: normal,
    failures: [
      { method: 'PUT', path: /^\/api\/favorites\//, status: 500, code: 'INTERNAL_ERROR', message: 'Não foi possível atualizar seus favoritos.' },
      { method: 'DELETE', path: /^\/api\/favorites\//, status: 500, code: 'INTERNAL_ERROR', message: 'Não foi possível atualizar seus favoritos.' },
    ],
    payment: confirm,
  },
  'wallet-rejected': {
    id: 'wallet-rejected',
    label: 'Carteira recusa conexão',
    description: 'A primeira solicitação de conexão de carteira é recusada pelo usuário.',
    latency: normal,
    walletRejected: true,
    payment: confirm,
  },
  'price-change': {
    id: 'price-change',
    label: 'Preço muda no checkout',
    description: 'Ao abrir o pagamento, o preço do primeiro item sobe após 4 s (evento nft.updated).',
    latency: normal,
    priceChangeOnCheckout: true,
    payment: confirm,
  },
  'sold-out': {
    id: 'sold-out',
    label: 'Edição esgota no checkout',
    description: 'A primeira tentativa de pedido encontra a edição do primeiro item esgotada.',
    latency: normal,
    soldOutOnCheckout: true,
    payment: confirm,
  },
  'order-timeout': {
    id: 'order-timeout',
    label: 'Timeout após criar pedido',
    description: 'O pedido é criado, mas a resposta excede o timeout; a nova tentativa recupera o mesmo pedido.',
    latency: normal,
    orderTimeout: true,
    payment: confirm,
  },
  'payment-declined': {
    id: 'payment-declined',
    label: 'Pagamento recusado',
    description: 'A rede recusa o pagamento após o pedido ficar pendente.',
    latency: normal,
    payment: { outcome: 'decline', delayMs: 2500 },
  },
  'payment-pending': {
    id: 'payment-pending',
    label: 'Pagamento demorado',
    description: 'O pedido permanece pendente por 20 s antes de confirmar.',
    latency: normal,
    payment: { outcome: 'confirm', delayMs: 20_000 },
  },
}

const SETTINGS_KEY = 'kurio.mock.settings'

export interface MockSettings {
  scenario: ScenarioId
  /** Força queda de conexão independente do cenário (útil para testar recuperação). */
  offline: boolean
}

let settings: MockSettings = { scenario: 'default', offline: false }

function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === 'string' && (scenarioIds as readonly string[]).includes(value)
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MockSettings>
      settings = {
        scenario: isScenarioId(parsed.scenario) ? parsed.scenario : 'default',
        offline: Boolean(parsed.offline),
      }
    }
  } catch {
    // mantém padrão
  }
  const fromUrl = new URLSearchParams(window.location.search).get('scenario')
  if (isScenarioId(fromUrl)) settings = { ...settings, scenario: fromUrl }
  saveSettings()
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent('kurio:mock-settings', { detail: settings }))
}

export function getSettings(): MockSettings {
  return settings
}

export function currentScenario(): ScenarioDefinition {
  return scenarios[settings.scenario]
}

export function setScenario(id: ScenarioId) {
  if (!isScenarioId(id)) throw new Error(`Cenário desconhecido: ${String(id)}`)
  settings = { ...settings, scenario: id }
  saveSettings()
}

export function setOffline(offline: boolean) {
  settings = { ...settings, offline }
  saveSettings()
}

export function isOffline() {
  return settings.offline || Boolean(currentScenario().offline)
}
