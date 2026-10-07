/**
 * Cliente Socket.IO da aplicação.
 *
 * - Um socket por sessão (token no `auth` do handshake). Troca de usuário ou logout
 *   destrói o socket anterior com todos os seus listeners.
 * - Assinaturas por tópico com contagem de referências: o servidor só envia
 *   `nft.updated` de tópicos assinados; ao zerar a contagem, `unsubscribe` é enviado.
 * - Deduplicação por id de evento e descarte de versões antigas por recurso.
 * - Após reconexão, reenvia assinaturas e pede reconciliação com a API REST.
 *
 * `socket.io-client` é importado dinamicamente depois que o MSW instala a interceptação
 * de WebSocket (o engine.io captura o construtor global no carregamento do módulo).
 */
import type { Socket } from 'socket.io-client'
import { NftUpdatedEvent, OrderUpdatedEvent } from '@/shared/contracts'
import { REALTIME_URL } from '@/shared/config'
import { mocksReady } from '@/app/mocks-ready'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export interface RealtimeHandlers {
  onNftUpdated: (event: NftUpdatedEvent) => void
  onOrderUpdated: (event: OrderUpdatedEvent) => void
  onReconnected: () => void
}

const MAX_SEEN = 500

export class RealtimeClient {
  private socket: Socket | null = null
  private generation = 0
  private readonly topics = new Map<string, number>()
  private readonly seen = new Set<string>()
  private readonly versions = new Map<string, number>()
  private readonly statusListeners = new Set<(status: ConnectionStatus) => void>()
  private status: ConnectionStatus = 'idle'
  private hasConnected = false
  private handlers: RealtimeHandlers | null = null

  setHandlers(handlers: RealtimeHandlers) {
    this.handlers = handlers
  }

  getStatus() {
    return this.status
  }

  onStatus(listener: (status: ConnectionStatus) => void) {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status
    for (const listener of this.statusListeners) listener(status)
  }

  /** Abre (ou reabre) a conexão para o token informado; `null` conecta como visitante. */
  async connect(token: string | null) {
    this.disconnect()
    const generation = ++this.generation
    this.setStatus('connecting')
    await mocksReady
    const { io } = await import('socket.io-client')
    if (generation !== this.generation) return

    const socket = io(REALTIME_URL, {
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnectionDelay: 500,
      reconnectionDelayMax: 4_000,
      timeout: 8_000,
    })
    this.socket = socket
    this.hasConnected = false

    socket.on('connect', () => {
      this.setStatus('connected')
      const topics = [...this.topics.keys()]
      if (topics.length) socket.emit('subscribe', { topics })
      if (this.hasConnected) this.handlers?.onReconnected()
      this.hasConnected = true
    })
    socket.on('disconnect', () => this.setStatus('reconnecting'))
    socket.io.on('reconnect_attempt', () => this.setStatus('reconnecting'))
    socket.on('connect_error', () => this.setStatus('reconnecting'))

    socket.on('nft.updated', (payload: unknown) => {
      const parsed = NftUpdatedEvent.safeParse(payload)
      if (parsed.success && this.accept(parsed.data.id, `nft:${parsed.data.resource.id}`, parsed.data.version)) {
        this.handlers?.onNftUpdated(parsed.data)
      }
    })
    socket.on('order.updated', (payload: unknown) => {
      const parsed = OrderUpdatedEvent.safeParse(payload)
      if (parsed.success && this.accept(parsed.data.id, `order:${parsed.data.resource.id}`, parsed.data.version)) {
        this.handlers?.onOrderUpdated(parsed.data)
      }
    })
  }

  disconnect() {
    this.generation++
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.io.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
    this.seen.clear()
    this.setStatus('disconnected')
  }

  /** Descarta eventos repetidos (mesmo id) ou antigos (versão ≤ conhecida). */
  private accept(eventId: string, resourceKey: string, version: number) {
    if (this.seen.has(eventId)) return false
    this.seen.add(eventId)
    if (this.seen.size > MAX_SEEN) this.seen.delete(this.seen.values().next().value!)
    const known = this.versions.get(resourceKey) ?? 0
    if (version <= known) return false
    this.versions.set(resourceKey, version)
    return true
  }

  /** Registra a versão vista via REST para que eventos mais antigos sejam ignorados. */
  observeVersion(resourceKey: string, version: number) {
    const known = this.versions.get(resourceKey) ?? 0
    if (version > known) this.versions.set(resourceKey, version)
  }

  knownVersion(resourceKey: string) {
    return this.versions.get(resourceKey) ?? 0
  }

  subscribe(topic: string) {
    const count = this.topics.get(topic) ?? 0
    this.topics.set(topic, count + 1)
    if (count === 0 && this.socket?.connected) this.socket.emit('subscribe', { topics: [topic] })
    let released = false
    return () => {
      if (released) return
      released = true
      const remaining = (this.topics.get(topic) ?? 1) - 1
      if (remaining <= 0) {
        this.topics.delete(topic)
        if (this.socket?.connected) this.socket.emit('unsubscribe', { topics: [topic] })
      } else {
        this.topics.set(topic, remaining)
      }
    }
  }

  activeTopics() {
    return [...this.topics.keys()]
  }
}

export const realtimeClient = new RealtimeClient()
