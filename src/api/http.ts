/**
 * Cliente HTTP único da aplicação. Toda chamada REST passa por aqui:
 *  - aguarda a camada de mocks (quando habilitada) antes da primeira requisição;
 *  - injeta token da sessão e identificador do carrinho de visitante;
 *  - normaliza erros em `ApiError` e sinaliza expiração de sessão;
 *  - valida o corpo das respostas contra os contratos (zod).
 */
import axios, { type AxiosRequestConfig } from 'axios'
import type { ZodType } from 'zod'
import { API_BASE_URL } from '@/shared/config'
import { guestCartId, sessionStore } from '@/features/session/session-store'
import { mocksReady } from '@/app/mocks-ready'
import { ApiError, toApiError } from './errors'

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { Accept: 'application/json' },
})

type SessionExpiredListener = () => void
const expiredListeners = new Set<SessionExpiredListener>()

export function onSessionExpired(listener: SessionExpiredListener) {
  expiredListeners.add(listener)
  return () => {
    expiredListeners.delete(listener)
  }
}

http.interceptors.request.use(async (config) => {
  await mocksReady
  const session = sessionStore.get()
  if (session) config.headers.Authorization = `Bearer ${session.token}`
  else config.headers['X-Guest-Cart-Id'] = guestCartId()
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error)
    const sentToken = String(error?.config?.headers?.Authorization ?? '').replace('Bearer ', '')
    const active = sessionStore.get()
    // Só encerra a sessão se o 401 se refere ao token ainda ativo (evita corrida com novo login).
    if (apiError.status === 401 && (apiError.code === 'SESSION_EXPIRED' || apiError.code === 'UNAUTHENTICATED') && active && sentToken === active.token) {
      for (const listener of expiredListeners) listener()
    }
    return Promise.reject(apiError)
  },
)

export async function request<T>(schema: ZodType<T>, config: AxiosRequestConfig): Promise<T> {
  const response = await http.request(config)
  const parsed = schema.safeParse(response.data)
  if (!parsed.success) {
    console.error('[api] contrato violado', config.url, parsed.error.issues)
    throw new ApiError('contract', 'Resposta do servidor fora do contrato esperado.', response.status, 'CONTRACT_MISMATCH')
  }
  return parsed.data
}

export async function requestVoid(config: AxiosRequestConfig): Promise<void> {
  await http.request(config)
}
