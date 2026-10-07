import { HttpResponse } from 'msw'
import type { ErrorCode } from '@/shared/contracts'
import type { ZodType } from 'zod'
import { db, mutate, type SessionRecord, type UserRecord } from '../db'

export const API = '/api'

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fieldErrors?: Record<string, string>,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

export function errorResponse(status: number, code: ErrorCode | string, message: string, extra: { fieldErrors?: Record<string, string>; details?: unknown } = {}) {
  return HttpResponse.json({ error: { code, message, ...extra } }, { status })
}

export interface ResolverArgs {
  request: Request
  params: Record<string, string | readonly string[] | undefined>
}

/** Envolve um resolver convertendo ApiFailure no envelope de erro padrão. */
export function handle(resolver: (args: ResolverArgs) => Promise<Response> | Response) {
  return async (args: ResolverArgs) => {
    try {
      return await resolver(args)
    } catch (error) {
      if (error instanceof ApiFailure) {
        return errorResponse(error.status, error.code, error.message, { fieldErrors: error.fieldErrors, details: error.details })
      }
      console.error('[mock] erro inesperado', error)
      return errorResponse(500, 'INTERNAL_ERROR', 'Erro inesperado na API simulada.')
    }
  }
}

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new ApiFailure(422, 'VALIDATION_ERROR', 'Corpo da requisição inválido.')
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form'
      fieldErrors[key] ??= issue.message
    }
    throw new ApiFailure(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', fieldErrors)
  }
  return parsed.data
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

export function findSession(token: string | null): { session: SessionRecord; user: UserRecord } | 'expired' | null {
  if (!token) return null
  const session = db().sessions.find((item) => item.token === token)
  if (!session) return null
  if (Date.parse(session.expiresAt) <= Date.now()) return 'expired'
  const user = db().users.find((item) => item.id === session.userId)
  return user ? { session, user } : null
}

/** Exige sessão válida; diferencia sessão expirada de requisição anônima. */
export function requireAuth(request: Request) {
  const token = bearerToken(request)
  const result = findSession(token)
  if (result === 'expired') {
    mutate((draft) => {
      draft.sessions = draft.sessions.filter((item) => item.token !== token)
    })
    throw new ApiFailure(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  if (!result) {
    throw new ApiFailure(401, token ? 'SESSION_EXPIRED' : 'UNAUTHENTICATED', token ? 'Sessão inválida. Entre novamente.' : 'Entre para continuar.')
  }
  return result
}

/** Sessão opcional (carrinho de visitante). Sessão expirada continua sendo erro 401. */
export function optionalAuth(request: Request) {
  const token = bearerToken(request)
  if (!token) return null
  return requireAuth(request)
}

export function toUserDto(user: UserRecord) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  }
}
