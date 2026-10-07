import type { CreateOrderInput, Order } from '@/shared/contracts'
import { CollectorSchema } from '@/shared/contracts'
import { db, mutate, nextId, nowIso, type OrderRecord } from '../db'
import { ApiFailure } from '../lib/http'
import { hexHash } from '../lib/random'
import { publishNftUpdated, publishOrderUpdated } from '../realtime'
import { currentScenario } from '../scenarios'
import { getCart, removePurchased, userCartKey } from './cart'
import { BLOCKING_ISSUES, computeQuote } from './quote'

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function toOrderDto(order: OrderRecord): Order {
  const { userId: _userId, idempotencyKey: _key, requestHash: _hash, settleAt: _settleAt, outcome: _outcome, ...dto } = order
  return dto
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function findOrderForUser(orderId: string, userId: string) {
  const order = db().orders.find((item) => item.id === orderId)
  if (!order) throw new ApiFailure(404, 'NOT_FOUND', 'Pedido não encontrado.')
  if (order.userId !== userId) throw new ApiFailure(403, 'FORBIDDEN', 'Este pedido pertence a outro colecionador.')
  return order
}

/** Estado do cenário "edição esgota no checkout": dispara uma única vez por carregamento. */
let soldOutTriggered = false

export interface CreateOrderResult {
  order: OrderRecord
  replayed: boolean
}

export function createOrder(userId: string, input: CreateOrderInput, idempotencyKey: string): CreateOrderResult {
  const requestHash = hexHash(stableStringify(input), 24)
  const existing = db().orders.find((order) => order.userId === userId && order.idempotencyKey === idempotencyKey)
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new ApiFailure(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
    }
    return { order: existing, replayed: true }
  }

  const connection = db().connections.find((item) => item.id === input.walletConnectionId && item.userId === userId)
  if (!connection || connection.status !== 'connected') {
    throw new ApiFailure(409, 'WALLET_DISCONNECTED', 'A carteira foi desconectada. Conecte novamente para continuar.')
  }

  const cart = getCart(userCartKey(userId))
  if (cart.items.length === 0) throw new ApiFailure(409, 'CART_EMPTY', 'Seu carrinho está vazio.')

  const scenario = currentScenario()
  if (scenario.soldOutOnCheckout && !soldOutTriggered) {
    soldOutTriggered = true
    const first = cart.items[0]
    const nft = db().nfts.find((record) => record.id === first.nftId)
    const edition = nft?.editions.find((item) => item.id === first.editionId)
    if (nft && edition) {
      mutate(() => {
        edition.available = 0
        edition.status = 'sold_out'
        nft.version += 1
      })
      publishNftUpdated(nft, nft.price, 'availability')
    }
  }

  const collector = CollectorSchema.parse(input.collector)
  const quote = computeQuote(cart, collector.network)
  if (quote.issues.some((issue) => BLOCKING_ISSUES.has(issue.code))) {
    throw new ApiFailure(409, 'OUT_OF_STOCK', 'Alguns itens não estão mais disponíveis na quantidade escolhida.', undefined, { quote })
  }
  if (quote.id !== input.quoteId) {
    throw new ApiFailure(409, 'QUOTE_CHANGED', 'Os valores do pedido mudaram. Revise e confirme novamente.', undefined, { quote })
  }

  const createdAt = nowIso()
  const order: OrderRecord = {
    id: nextId('ord'),
    status: 'pending',
    declineReason: null,
    quoteId: quote.id,
    network: quote.network,
    items: quote.items.map(({ cartItemId: _cartItemId, ...item }) => item),
    subtotal: quote.subtotal,
    discount: quote.discount,
    couponCode: quote.coupon?.code ?? null,
    networkFee: quote.networkFee,
    total: quote.total,
    wallet: { provider: connection.provider, address: connection.address },
    collector: { displayName: collector.displayName, username: collector.username, email: collector.email, ensName: collector.ensName },
    transaction: null,
    createdAt,
    updatedAt: createdAt,
    confirmedAt: null,
    version: 1,
    userId,
    idempotencyKey,
    requestHash,
    settleAt: Date.now() + scenario.payment.delayMs,
    outcome: scenario.payment.outcome,
  }
  mutate((draft) => {
    draft.orders.push(order)
  })
  scheduleSettlement(order)
  return { order, replayed: false }
}

function scheduleSettlement(order: OrderRecord) {
  if (order.status !== 'pending' || timers.has(order.id)) return
  const wait = Math.max(0, order.settleAt - Date.now())
  timers.set(
    order.id,
    setTimeout(() => {
      timers.delete(order.id)
      settleOrder(order.id)
    }, wait),
  )
}

/** Conclui a simulação de pagamento: confirma (baixando estoque) ou recusa. Estados finais são terminais. */
export function settleOrder(orderId: string) {
  const order = db().orders.find((item) => item.id === orderId)
  if (!order || order.status !== 'pending') return

  let declineReason: string | null = order.outcome === 'decline' ? 'Pagamento recusado pela carteira: saldo insuficiente para cobrir o total e a taxa de rede.' : null
  if (!declineReason) {
    const shortage = order.items.find((item) => {
      const edition = db()
        .nfts.find((record) => record.id === item.nftId)
        ?.editions.find((candidate) => candidate.id === item.editionId)
      return !edition || edition.status !== 'available' || edition.available < item.quantity
    })
    if (shortage) declineReason = `${shortage.name} esgotou antes da confirmação na rede.`
  }

  const confirmed = !declineReason
  const touchedNfts = new Map<string, string>()
  mutate((draft) => {
    const now = nowIso()
    if (declineReason) {
      order.status = 'declined'
      order.declineReason = declineReason
    } else {
      for (const item of order.items) {
        const nft = draft.nfts.find((record) => record.id === item.nftId)!
        const edition = nft.editions.find((candidate) => candidate.id === item.editionId)!
        if (edition.supply !== null) edition.available -= item.quantity
        if (edition.available === 0) edition.status = 'sold_out'
        if (!touchedNfts.has(nft.id)) {
          touchedNfts.set(nft.id, nft.price)
          nft.version += 1
        }
      }
      const blockNumber = 19_400_000 + (draft.counters.block = (draft.counters.block ?? 0) + 1)
      order.status = 'confirmed'
      order.confirmedAt = now
      order.transaction = { hash: `0x${hexHash(`${order.id}:${order.requestHash}`, 64)}`, blockNumber }
    }
    order.updatedAt = now
    order.version += 1
  })

  if (confirmed) {
    removePurchased(order.userId, order.items)
    for (const [nftId, previousPrice] of touchedNfts) {
      const nft = db().nfts.find((record) => record.id === nftId)
      if (nft) publishNftUpdated(nft, previousPrice, 'purchase')
    }
  }
  publishOrderUpdated(order)
}

/** Recupera pedidos pendentes após refresh: liquida os vencidos e reagenda os demais. */
export function resumePendingOrders() {
  for (const order of db().orders) {
    if (order.status !== 'pending') continue
    if (order.settleAt <= Date.now()) settleOrder(order.id)
    else scheduleSettlement(order)
  }
}

export function clearOrderTimers() {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  soldOutTriggered = false
}
