/** Configuração resolvida a partir das variáveis de ambiente do Vite. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
export const REALTIME_URL = (import.meta.env.VITE_REALTIME_URL || 'wss://realtime.kurio.local').replace(/\/$/, '')
export const MOCKS_ENABLED = (import.meta.env.VITE_ENABLE_MOCKS ?? 'true') !== 'false'

/** Protótipo: com a API simulada, o login já vem preenchido com a conta de demonstração (Ana, ver `mocks/fixtures/accounts.ts`). */
export const DEMO_LOGIN = MOCKS_ENABLED ? { email: 'ana@kurio.dev', password: 'Kurio2026' } : null
