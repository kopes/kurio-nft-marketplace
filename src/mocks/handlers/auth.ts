import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/shared/config'
import { LoginInput, RegisterInput, type Session } from '@/shared/contracts'
import { db, mutate, nextId, nowIso, type UserRecord } from '../db'
import { ApiFailure, handle, readJson, requireAuth, toUserDto } from '../lib/http'
import { hashPassword, randomToken, verifyPassword } from '../lib/password'
import { currentScenario } from '../scenarios'

const DEFAULT_SESSION_TTL_MS = 2 * 60 * 60 * 1000

function createSession(user: UserRecord): Session {
  const ttl = currentScenario().sessionTtlMs ?? DEFAULT_SESSION_TTL_MS
  const session = {
    token: randomToken('tok'),
    userId: user.id,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + ttl).toISOString(),
  }
  mutate((draft) => {
    draft.sessions.push(session)
  })
  return { token: session.token, expiresAt: session.expiresAt, user: toUserDto(user) }
}

export const authHandlers = [
  http.post(
    `${API_BASE_URL}/auth/register`,
    handle(async ({ request }) => {
      const input = await readJson(request, RegisterInput)
      const email = input.email.toLowerCase()
      const fieldErrors: Record<string, string> = {}
      if (db().users.some((user) => user.email === email)) fieldErrors.email = 'Este e-mail já está cadastrado'
      if (db().users.some((user) => user.username.toLowerCase() === input.username.toLowerCase())) {
        fieldErrors.username = 'Este nome de usuário já está em uso'
      }
      if (fieldErrors.email) throw new ApiFailure(409, 'EMAIL_TAKEN', 'Já existe uma conta com este e-mail.', fieldErrors)
      if (fieldErrors.username) throw new ApiFailure(409, 'USERNAME_TAKEN', 'Nome de usuário indisponível.', fieldErrors)

      const { hash, salt } = await hashPassword(input.password)
      const now = nowIso()
      const user: UserRecord = {
        id: nextId('usr'),
        username: input.username,
        email,
        displayName: input.username,
        ensName: input.username.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        walletNickname: 'Minha carteira',
        avatarUrl: null,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: now,
        updatedAt: now,
        version: 1,
      }
      mutate((draft) => {
        draft.users.push(user)
        draft.favorites[user.id] = []
      })
      return HttpResponse.json(createSession(user), { status: 201 })
    }),
  ),

  http.post(
    `${API_BASE_URL}/auth/login`,
    handle(async ({ request }) => {
      const input = await readJson(request, LoginInput)
      const user = db().users.find((item) => item.email === input.email.toLowerCase())
      if (!user || !(await verifyPassword(input.password, user.passwordSalt, user.passwordHash))) {
        throw new ApiFailure(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
      }
      return HttpResponse.json(createSession(user))
    }),
  ),

  http.get(
    `${API_BASE_URL}/auth/session`,
    handle(({ request }) => {
      const { session, user } = requireAuth(request)
      return HttpResponse.json({ expiresAt: session.expiresAt, user: toUserDto(user) })
    }),
  ),

  http.post(
    `${API_BASE_URL}/auth/logout`,
    handle(({ request }) => {
      const token = request.headers.get('authorization')?.replace('Bearer ', '')
      mutate((draft) => {
        const session = draft.sessions.find((item) => item.token === token)
        draft.sessions = draft.sessions.filter((item) => item.token !== token)
        if (session) {
          for (const connection of draft.connections) {
            if (connection.userId === session.userId) connection.status = 'disconnected'
          }
        }
      })
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
