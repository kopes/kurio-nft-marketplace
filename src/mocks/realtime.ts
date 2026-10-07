/**
 * Servidor Socket.IO simulado sobre `ws.link` do MSW + `@mswjs/socket.io-binding`.
 *
 * O cliente real (`socket.io-client`, transporte websocket) conecta em
 * `${REALTIME_URL}/socket.io/` (o MSW normaliza o caminho do Socket.IO). Este módulo:
 *  - identifica o usuário pelo pacote CONNECT (`auth.token`), isolando eventos por sessão;
 *  - mantém assinaturas por tópico (`nft:<id>`), liberadas via `unsubscribe` ou ao fechar a conexão;
 *  - envia pings do Engine.IO (o binding simula apenas o handshake);
 *  - publica `nft.updated` e `order.updated` a partir das mutações do banco simulado.
 */
import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/shared/contracts'
import { REALTIME_URL } from '@/shared/config'
import { nextId } from './db'
import type { NftRecord } from './fixtures/nfts'
import type { OrderRecord } from './db'
import { findSession } from './lib/http'
import { isOffline } from './scenarios'
import { availableUnits } from './services/catalog'

type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent

interface ConnectedClient {
  id: string
  userId: string | null
  topics: Set<string>
  emit: (event: string, payload: unknown) => void
  close: () => void
}

const clients = new Set<ConnectedClient>()
const history: Array<{ event: RealtimeEvent; userId: string | null }> = []
const PING_INTERVAL_MS = 20_000

// O MSW remove o prefixo "/socket.io/" da URL do cliente antes de comparar; o link aponta para a raiz.
const link = ws.link(REALTIME_URL)

export const realtimeHandler = link.addEventListener('connection', (connection) => onConnection(connection))

function onConnection(connection: Parameters<Parameters<typeof link.addEventListener>[1]>[0]) {
  if (isOffline()) {
    // Sem rede: recusa a conexão; o socket.io-client tentará reconectar com backoff.
    queueMicrotask(() => connection.client.close(1011, 'offline'))
    return
  }

  const io = toSocketIo(connection)
  const client: ConnectedClient = {
    id: connection.client.id,
    userId: null,
    topics: new Set(),
    emit: (event, payload) => io.client.emit(event, payload),
    close: () => connection.client.close(1000, 'server close'),
  }
  clients.add(client)

  // O pacote CONNECT ("40{...}") carrega `auth`; o binding só decodifica pacotes EVENT.
  connection.client.addEventListener('message', (event) => {
    if (typeof event.data !== 'string' || !event.data.startsWith('40')) return
    const session = findSession(parseAuthToken(event.data.slice(2)))
    client.userId = session && session !== 'expired' ? session.user.id : null
    // Aguarda o cliente processar o CONNECT simulado pelo binding.
    setTimeout(() => client.emit('session.ready', { authenticated: Boolean(client.userId) }), 0)
  })

  io.client.on('subscribe', (_event, payload: { topics?: unknown }) => {
    for (const topic of Array.isArray(payload?.topics) ? payload.topics : []) {
      if (typeof topic === 'string') client.topics.add(topic)
    }
  })

  io.client.on('unsubscribe', (_event, payload: { topics?: unknown }) => {
    for (const topic of Array.isArray(payload?.topics) ? payload.topics : []) {
      if (typeof topic === 'string') client.topics.delete(topic)
    }
  })

  const ping = setInterval(() => connection.client.send('2'), PING_INTERVAL_MS)
  connection.client.addEventListener('close', () => {
    clearInterval(ping)
    clients.delete(client)
  })
}

function parseAuthToken(payload: string) {
  try {
    const auth = JSON.parse(payload || '{}') as { token?: unknown }
    return typeof auth.token === 'string' ? auth.token : null
  } catch {
    return null
  }
}

function deliver(event: RealtimeEvent, userId: string | null) {
  history.push({ event, userId })
  if (history.length > 50) history.shift()
  for (const client of clients) {
    if (event.type === 'order.updated') {
      if (client.userId && client.userId === userId) client.emit(event.type, event)
    } else if (client.topics.has(`nft:${event.resource.id}`) || client.topics.has('nft:*')) {
      client.emit(event.type, event)
    }
  }
}

export function publishNftUpdated(record: NftRecord, previousPrice: string, reason: NftUpdatedEvent['data']['reason']) {
  const event: NftUpdatedEvent = {
    id: nextId('evt'),
    type: 'nft.updated',
    resource: { type: 'nft', id: record.id },
    version: record.version,
    occurredAt: new Date().toISOString(),
    data: {
      name: record.name,
      price: record.price,
      previousPrice,
      compareAtPrice: record.compareAtPrice,
      available: availableUnits(record),
      editions: record.editions.map(({ id, available, status }) => ({ id, available, status })),
      reason,
    },
  }
  deliver(event, null)
  return event
}

export function publishOrderUpdated(order: OrderRecord) {
  const event: OrderUpdatedEvent = {
    id: nextId('evt'),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    userId: order.userId,
    data: { status: order.status, declineReason: order.declineReason, transaction: order.transaction },
  }
  deliver(event, order.userId)
  return event
}

/** Reenvia o último evento (mesmo id e versão) para exercitar a deduplicação no cliente. */
export function replayLastEvent(type?: RealtimeEvent['type']) {
  const entry = [...history].reverse().find((item) => !type || item.event.type === type)
  if (entry) deliver(entry.event, entry.userId)
  return entry?.event ?? null
}

/** Envia um evento com versão anterior à atual (não deve regredir o estado no cliente). */
export function emitStaleNftEvent(record: NftRecord, stalePrice: string) {
  const event: NftUpdatedEvent = {
    id: nextId('evt'),
    type: 'nft.updated',
    resource: { type: 'nft', id: record.id },
    version: Math.max(0, record.version - 1),
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    data: {
      name: record.name,
      price: stalePrice,
      previousPrice: record.price,
      compareAtPrice: record.compareAtPrice,
      available: availableUnits(record),
      editions: record.editions.map(({ id, available, status }) => ({ id, available, status })),
      reason: 'price',
    },
  }
  deliver(event, null)
  return event
}

/** Derruba todas as conexões ativas (simula queda do servidor de tempo real). */
export function dropConnections() {
  for (const client of [...clients]) client.close()
}

export function connectedClients() {
  return [...clients].map((client) => ({ id: client.id, userId: client.userId, topics: [...client.topics] }))
}
