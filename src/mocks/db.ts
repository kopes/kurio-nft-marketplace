/**
 * Banco de dados da API simulada.
 *
 * Mantém um estado único e consistente entre catálogo, favoritos, carrinhos, perfis,
 * carteiras e pedidos. O estado é persistido em localStorage para sobreviver a refresh;
 * `resetDb()` restaura integralmente o cenário conhecido a partir das fixtures.
 */
import type { EditionId, NetworkId, Order, WalletProvider } from '@/shared/contracts'
import { demoUsers, demoWallets, type WalletFixture } from './fixtures/accounts'
import { buildNftFixtures, type NftRecord } from './fixtures/nfts'
import { hashPassword } from './lib/password'

export interface UserRecord {
  id: string
  username: string
  email: string
  displayName: string
  ensName: string
  walletNickname: string
  avatarUrl: string | null
  passwordHash: string
  passwordSalt: string
  createdAt: string
  updatedAt: string
  version: number
}

export interface SessionRecord {
  token: string
  userId: string
  createdAt: string
  expiresAt: string
}

export interface CartItemRecord {
  id: string
  nftId: string
  editionId: EditionId
  quantity: number
  /** Preço que o usuário viu ao adicionar/alterar o item; difere do atual quando o preço muda. */
  acknowledgedPrice: string
  addedAt: string
}

export interface CartRecord {
  id: string
  ownerKey: string
  items: CartItemRecord[]
  couponCode: string | null
  version: number
  updatedAt: string
}

export interface WalletRecord extends WalletFixture {
  updatedAt: string
  version: number
}

export interface ConnectionRecord {
  id: string
  userId: string
  provider: WalletProvider
  network: NetworkId
  address: string
  status: 'connected' | 'disconnected'
  connectedAt: string
}

export interface OrderRecord extends Order {
  userId: string
  idempotencyKey: string
  requestHash: string
  settleAt: number
  outcome: 'confirm' | 'decline'
}

export interface DbState {
  schema: number
  users: UserRecord[]
  sessions: SessionRecord[]
  nfts: NftRecord[]
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  wallets: WalletRecord[]
  connections: ConnectionRecord[]
  orders: OrderRecord[]
  counters: Record<string, number>
}

const STORAGE_KEY = 'kurio.mock.db'
const SCHEMA = 5

let state: DbState | null = null
let saveScheduled = false

async function buildSeed(): Promise<DbState> {
  const createdAt = new Date('2026-08-01T12:00:00.000Z').toISOString()
  const users: UserRecord[] = []
  for (const user of demoUsers) {
    const { hash, salt } = await hashPassword(user.password, `seed-${user.id}`)
    users.push({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      ensName: user.ensName,
      walletNickname: user.walletNickname,
      avatarUrl: null,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt,
      updatedAt: createdAt,
      version: 1,
    })
  }

  return {
    schema: SCHEMA,
    users,
    sessions: [],
    nfts: buildNftFixtures(),
    favorites: Object.fromEntries(demoUsers.map((user) => [user.id, [...user.favorites]])),
    carts: {},
    wallets: demoWallets.map((wallet) => ({ ...wallet, updatedAt: createdAt, version: 1 })),
    connections: [],
    orders: [],
    counters: {},
  }
}

function readStorage(): DbState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DbState
    return parsed.schema === SCHEMA ? parsed : null
  } catch {
    return null
  }
}

function persist() {
  if (!state) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Armazenamento indisponível (modo privado, cota): o mock segue em memória.
  }
}

export async function initDb() {
  state = readStorage() ?? (await buildSeed())
  persist()
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) state = readStorage() ?? state
  })
}

export async function resetDb() {
  state = await buildSeed()
  persist()
}

export function db(): DbState {
  if (!state) throw new Error('Banco simulado não inicializado')
  return state
}

/** Aplica uma mutação e agenda a persistência (agrupada por microtask). */
export function mutate<T>(fn: (draft: DbState) => T): T {
  const result = fn(db())
  if (!saveScheduled) {
    saveScheduled = true
    queueMicrotask(() => {
      saveScheduled = false
      persist()
    })
  }
  return result
}

export function nextId(prefix: string) {
  return mutate((draft) => {
    const value = (draft.counters[prefix] ?? 0) + 1
    draft.counters[prefix] = value
    return `${prefix}_${String(value).padStart(4, '0')}`
  })
}

export function nowIso() {
  return new Date().toISOString()
}
