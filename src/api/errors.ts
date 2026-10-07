import { AxiosError, isCancel } from 'axios'
import { ApiErrorBody, type ErrorCode } from '@/shared/contracts'

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'canceled' | 'contract'

/** Erro normalizado de qualquer chamada REST: a interface só lida com este formato. */
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status: number | null = null,
    readonly code: ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'CANCELED' | 'CONTRACT_MISMATCH' = 'NETWORK_ERROR',
    readonly fieldErrors: Record<string, string> = {},
    readonly details: unknown = undefined,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Falhas transitórias que podem ser repetidas com segurança (consultas idempotentes). */
  get retryable() {
    return this.kind === 'network' || this.kind === 'timeout' || (this.status !== null && this.status >= 500)
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isCancel(error)) return new ApiError('canceled', 'Requisição cancelada.', null, 'CANCELED')
  if (error instanceof AxiosError) {
    if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
      return new ApiError('timeout', 'O servidor demorou para responder.', null, 'TIMEOUT')
    }
    if (!error.response) {
      return new ApiError('network', 'Sem conexão com o servidor. Verifique sua internet e tente novamente.', null, 'NETWORK_ERROR')
    }
    const parsed = ApiErrorBody.safeParse(error.response.data)
    if (parsed.success) {
      const { code, message, fieldErrors, details } = parsed.data.error
      return new ApiError('http', message, error.response.status, code, fieldErrors ?? {}, details)
    }
    return new ApiError('http', `Erro inesperado (${error.response.status}).`, error.response.status, 'INTERNAL_ERROR')
  }
  return new ApiError('contract', 'Resposta inesperada do servidor.', null, 'CONTRACT_MISMATCH')
}

export function errorMessage(error: unknown) {
  return toApiError(error).message
}
