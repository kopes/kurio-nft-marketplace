import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/shared/config'
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  PasswordChangeInput,
  ProfileUpdateInput,
  WalletConnectInput,
  WalletInput,
  isValidAddress,
  type Profile,
  type Wallet,
} from '@/shared/contracts'
import { db, mutate, nextId, nowIso, type UserRecord, type WalletRecord } from '../db'
import { ApiFailure, handle, readJson, requireAuth } from '../lib/http'
import { hashPassword, verifyPassword } from '../lib/password'
import { currentScenario } from '../scenarios'

function toProfile(user: UserRecord): Profile {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    ensName: user.ensName,
    walletNickname: user.walletNickname,
    avatarUrl: user.avatarUrl,
    updatedAt: user.updatedAt,
    version: user.version,
  }
}

function toWallet(record: WalletRecord): Wallet {
  const { userId: _userId, ...wallet } = record
  return wallet
}

async function fileToDataUrl(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${file.type};base64,${btoa(binary)}`
}

let walletRejectionTriggered = false

export function resetAccountScenarioFlags() {
  walletRejectionTriggered = false
}

export const profileHandlers = [
  http.get(
    `${API_BASE_URL}/profile`,
    handle(({ request }) => HttpResponse.json(toProfile(requireAuth(request).user))),
  ),

  http.patch(
    `${API_BASE_URL}/profile`,
    handle(async ({ request }) => {
      const { user } = requireAuth(request)
      const input = await readJson(request, ProfileUpdateInput)
      const email = input.email.toLowerCase()
      const others = db().users.filter((item) => item.id !== user.id)
      if (others.some((item) => item.username.toLowerCase() === input.username.toLowerCase())) {
        throw new ApiFailure(409, 'USERNAME_TAKEN', 'Nome de usuário indisponível.', { username: 'Este nome de usuário já está em uso' })
      }
      if (others.some((item) => item.email === email)) {
        throw new ApiFailure(409, 'EMAIL_TAKEN', 'E-mail já cadastrado em outra conta.', { email: 'Este e-mail já está cadastrado' })
      }
      mutate(() => {
        Object.assign(user, { ...input, email, updatedAt: nowIso(), version: user.version + 1 })
      })
      return HttpResponse.json(toProfile(user))
    }),
  ),

  http.put(
    `${API_BASE_URL}/profile/avatar`,
    handle(async ({ request }) => {
      const { user } = requireAuth(request)
      const form = await request.formData().catch(() => null)
      const file = form?.get('avatar')
      if (!(file instanceof File)) throw new ApiFailure(422, 'VALIDATION_ERROR', 'Envie uma imagem.', { avatar: 'Selecione uma imagem' })
      if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
        throw new ApiFailure(422, 'VALIDATION_ERROR', 'Formato não suportado.', { avatar: 'Use PNG, JPG ou WebP' })
      }
      if (file.size > AVATAR_MAX_BYTES) {
        throw new ApiFailure(422, 'VALIDATION_ERROR', 'Imagem muito grande.', { avatar: 'A imagem deve ter no máximo 1 MB' })
      }
      const avatarUrl = await fileToDataUrl(file)
      mutate(() => {
        Object.assign(user, { avatarUrl, updatedAt: nowIso(), version: user.version + 1 })
      })
      return HttpResponse.json(toProfile(user))
    }),
  ),

  http.delete(
    `${API_BASE_URL}/profile/avatar`,
    handle(({ request }) => {
      const { user } = requireAuth(request)
      mutate(() => {
        Object.assign(user, { avatarUrl: null, updatedAt: nowIso(), version: user.version + 1 })
      })
      return HttpResponse.json(toProfile(user))
    }),
  ),

  http.post(
    `${API_BASE_URL}/profile/password`,
    handle(async ({ request }) => {
      const { user } = requireAuth(request)
      const input = await readJson(request, PasswordChangeInput)
      if (!(await verifyPassword(input.currentPassword, user.passwordSalt, user.passwordHash))) {
        throw new ApiFailure(422, 'VALIDATION_ERROR', 'Senha atual incorreta.', { currentPassword: 'Senha atual incorreta' })
      }
      const { hash, salt } = await hashPassword(input.newPassword)
      mutate(() => {
        Object.assign(user, { passwordHash: hash, passwordSalt: salt, updatedAt: nowIso(), version: user.version + 1 })
      })
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]

function findWallet(id: string, userId: string) {
  const wallet = db().wallets.find((item) => item.id === id)
  if (!wallet) throw new ApiFailure(404, 'NOT_FOUND', 'Carteira não encontrada.')
  if (wallet.userId !== userId) throw new ApiFailure(403, 'FORBIDDEN', 'Esta carteira pertence a outro colecionador.')
  return wallet
}

export const walletHandlers = [
  http.get(
    `${API_BASE_URL}/wallets`,
    handle(({ request }) => {
      const { user } = requireAuth(request)
      const items = db()
        .wallets.filter((wallet) => wallet.userId === user.id)
        .sort((a, b) => (a.role === 'primary' ? -1 : b.role === 'primary' ? 1 : 0))
        .map(toWallet)
      return HttpResponse.json({ items })
    }),
  ),

  http.post(
    `${API_BASE_URL}/wallets`,
    handle(async ({ request }) => {
      const { user } = requireAuth(request)
      const input = await readJson(request, WalletInput)
      if (db().wallets.some((wallet) => wallet.userId === user.id && wallet.role === input.role)) {
        throw new ApiFailure(409, 'WALLET_ROLE_TAKEN', 'Você já possui uma carteira com este papel. Edite a existente.')
      }
      const now = nowIso()
      const record: WalletRecord = { ...input, secondaryAddress: input.secondaryAddress ?? '', id: nextId('wal'), userId: user.id, updatedAt: now, version: 1 }
      mutate((draft) => {
        draft.wallets.push(record)
      })
      return HttpResponse.json(toWallet(record), { status: 201 })
    }),
  ),

  http.patch(
    `${API_BASE_URL}/wallets/:walletId`,
    handle(async ({ request, params }) => {
      const { user } = requireAuth(request)
      const wallet = findWallet(String(params.walletId), user.id)
      const input = await readJson(request, WalletInput)
      if (input.role !== wallet.role) throw new ApiFailure(422, 'VALIDATION_ERROR', 'O papel da carteira não pode ser alterado.')
      mutate(() => {
        Object.assign(wallet, { ...input, secondaryAddress: input.secondaryAddress ?? '', updatedAt: nowIso(), version: wallet.version + 1 })
      })
      return HttpResponse.json(toWallet(wallet))
    }),
  ),

  http.post(
    `${API_BASE_URL}/wallet-connections`,
    handle(async ({ request }) => {
      const { user } = requireAuth(request)
      const input = await readJson(request, WalletConnectInput)
      if (!isValidAddress(input.network, input.address)) {
        throw new ApiFailure(422, 'VALIDATION_ERROR', 'Endereço incompatível com a rede selecionada.', { walletAddress: 'Endereço incompatível com a rede' })
      }
      if (currentScenario().walletRejected && !walletRejectionTriggered) {
        walletRejectionTriggered = true
        throw new ApiFailure(409, 'WALLET_REJECTED', 'A conexão foi recusada na carteira. Tente novamente.')
      }
      const connection = {
        id: nextId('conn'),
        userId: user.id,
        provider: input.provider,
        network: input.network,
        address: input.address,
        status: 'connected' as const,
        connectedAt: nowIso(),
      }
      mutate((draft) => {
        for (const item of draft.connections) if (item.userId === user.id) item.status = 'disconnected'
        draft.connections.push(connection)
      })
      const { userId: _userId, ...dto } = connection
      return HttpResponse.json(dto, { status: 201 })
    }),
  ),

  http.delete(
    `${API_BASE_URL}/wallet-connections/:connectionId`,
    handle(({ request, params }) => {
      const { user } = requireAuth(request)
      const connection = db().connections.find((item) => item.id === params.connectionId && item.userId === user.id)
      if (!connection) throw new ApiFailure(404, 'NOT_FOUND', 'Conexão não encontrada.')
      mutate(() => {
        connection.status = 'disconnected'
      })
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
