import type { AddCartItemInput, Cart, CartItem, CartItemIssue } from '@/shared/contracts'
import { compareEth, mulEth } from '@/shared/eth'
import { db, mutate, nextId, nowIso, type CartRecord, type CartItemRecord } from '../db'
import { ApiFailure, optionalAuth } from '../lib/http'
import { findNft } from './catalog'

const GUEST_ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/

export function userCartKey(userId: string) {
  return `user:${userId}`
}

export function guestCartKey(guestId: string) {
  return `guest:${guestId}`
}

/** Resolve o carrinho da requisição: usuário autenticado ou visitante (header X-Guest-Cart-Id). */
export function resolveCartOwner(request: Request) {
  const auth = optionalAuth(request)
  if (auth) return { key: userCartKey(auth.user.id), owner: 'user' as const, userId: auth.user.id }
  const guestId = request.headers.get('x-guest-cart-id')
  if (!guestId || !GUEST_ID_PATTERN.test(guestId)) {
    throw new ApiFailure(422, 'VALIDATION_ERROR', 'Identificador do carrinho de visitante ausente.')
  }
  return { key: guestCartKey(guestId), owner: 'guest' as const, userId: null }
}

export function getCart(key: string): CartRecord {
  const existing = db().carts[key]
  if (existing) return existing
  return mutate((draft) => {
    const cart: CartRecord = { id: nextId('cart'), ownerKey: key, items: [], couponCode: null, version: 1, updatedAt: nowIso() }
    draft.carts[key] = cart
    return cart
  })
}

export function touch(cart: CartRecord) {
  cart.version += 1
  cart.updatedAt = nowIso()
}

function itemIssue(item: CartItemRecord): { issue: CartItemIssue | null; available: number; maxQuantity: number } {
  const nft = db().nfts.find((record) => record.id === item.nftId)
  const edition = nft?.editions.find((candidate) => candidate.id === item.editionId)
  if (!nft || !edition || edition.status === 'unavailable') return { issue: 'UNAVAILABLE', available: 0, maxQuantity: 0 }
  const maxQuantity = Math.min(edition.available, edition.maxPerOrder)
  if (edition.available === 0) return { issue: 'SOLD_OUT', available: 0, maxQuantity: 0 }
  if (item.quantity > edition.available) return { issue: 'INSUFFICIENT_STOCK', available: edition.available, maxQuantity }
  if (compareEth(item.acknowledgedPrice, nft.price) !== 0) return { issue: 'PRICE_CHANGED', available: edition.available, maxQuantity }
  return { issue: null, available: edition.available, maxQuantity }
}

export function toCartItemDto(item: CartItemRecord): CartItem {
  const nft = findNft(item.nftId)
  const edition = nft.editions.find((candidate) => candidate.id === item.editionId)
  const { issue, available, maxQuantity } = itemIssue(item)
  return {
    id: item.id,
    nftId: nft.id,
    editionId: item.editionId,
    editionLabel: edition?.label ?? item.editionId,
    name: nft.name,
    tokenId: nft.tokenId,
    artwork: nft.artwork,
    network: nft.network,
    quantity: item.quantity,
    unitPrice: nft.price,
    lineTotal: mulEth(nft.price, item.quantity),
    previousUnitPrice: compareEth(item.acknowledgedPrice, nft.price) !== 0 ? item.acknowledgedPrice : null,
    available,
    maxQuantity,
    issue,
    nftVersion: nft.version,
  }
}

export function toCartDto(cart: CartRecord, owner: 'guest' | 'user'): Cart {
  const items = cart.items.map(toCartItemDto)
  return {
    id: cart.id,
    owner,
    items,
    couponCode: cart.couponCode,
    itemCount: items.length,
    totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
    version: cart.version,
    updatedAt: cart.updatedAt,
  }
}

function assertQuantity(nftId: string, editionId: AddCartItemInput['editionId'], quantity: number) {
  const nft = findNft(nftId)
  const edition = nft.editions.find((candidate) => candidate.id === editionId)
  if (!edition || edition.status === 'unavailable') {
    throw new ApiFailure(409, 'EDITION_UNAVAILABLE', `A edição selecionada de ${nft.name} está indisponível.`)
  }
  if (edition.available === 0) {
    throw new ApiFailure(409, 'OUT_OF_STOCK', `A edição ${edition.label} de ${nft.name} está esgotada.`, undefined, { available: 0 })
  }
  if (quantity > edition.maxPerOrder) {
    throw new ApiFailure(409, 'QUANTITY_LIMIT', `Limite de ${edition.maxPerOrder} unidade(s) por pedido para a edição ${edition.label}.`, undefined, {
      max: edition.maxPerOrder,
    })
  }
  if (quantity > edition.available) {
    throw new ApiFailure(409, 'OUT_OF_STOCK', `Restam apenas ${edition.available} unidade(s) da edição ${edition.label}.`, undefined, {
      available: edition.available,
    })
  }
  return nft
}

export function addItem(cart: CartRecord, input: AddCartItemInput) {
  const existing = cart.items.find((item) => item.nftId === input.nftId && item.editionId === input.editionId)
  const quantity = (existing?.quantity ?? 0) + input.quantity
  const nft = assertQuantity(input.nftId, input.editionId, quantity)
  mutate(() => {
    if (existing) {
      existing.quantity = quantity
      existing.acknowledgedPrice = nft.price
    } else {
      cart.items.push({
        id: nextId('item'),
        nftId: input.nftId,
        editionId: input.editionId,
        quantity,
        acknowledgedPrice: nft.price,
        addedAt: nowIso(),
      })
    }
    touch(cart)
  })
}

export function findItem(cart: CartRecord, itemId: string) {
  const item = cart.items.find((candidate) => candidate.id === itemId)
  if (!item) throw new ApiFailure(404, 'NOT_FOUND', 'Item não encontrado no carrinho.')
  return item
}

export function updateItem(cart: CartRecord, itemId: string, quantity: number) {
  const item = findItem(cart, itemId)
  // Diminuir quantidade de um item com estoque insuficiente é sempre permitido até o disponível.
  const nft = assertQuantity(item.nftId, item.editionId, quantity)
  mutate(() => {
    item.quantity = quantity
    item.acknowledgedPrice = nft.price
    touch(cart)
  })
}

export function removeItem(cart: CartRecord, itemId: string) {
  findItem(cart, itemId)
  mutate(() => {
    cart.items = cart.items.filter((item) => item.id !== itemId)
    touch(cart)
  })
}

/** Une o carrinho do visitante ao do usuário, respeitando limites e disponibilidade. */
export function mergeGuestCart(userId: string, guestId: string) {
  const target = getCart(userCartKey(userId))
  const source = db().carts[guestCartKey(guestId)]
  if (!source) return target
  mutate((draft) => {
    for (const guestItem of source.items) {
      const nft = draft.nfts.find((record) => record.id === guestItem.nftId)
      const edition = nft?.editions.find((candidate) => candidate.id === guestItem.editionId)
      if (!nft || !edition || edition.status !== 'available') continue
      const existing = target.items.find((item) => item.nftId === guestItem.nftId && item.editionId === guestItem.editionId)
      const limit = Math.min(edition.available, edition.maxPerOrder)
      const quantity = Math.min(limit, (existing?.quantity ?? 0) + guestItem.quantity)
      if (quantity < 1) continue
      if (existing) {
        existing.quantity = quantity
      } else {
        target.items.push({ ...guestItem, id: nextId('item'), quantity })
      }
    }
    target.couponCode ??= source.couponCode
    delete draft.carts[guestCartKey(guestId)]
    touch(target)
  })
  return target
}

/** Após confirmação, remove do carrinho apenas os itens e quantidades comprados. */
export function removePurchased(userId: string, purchased: Array<{ nftId: string; editionId: string; quantity: number }>) {
  const cart = db().carts[userCartKey(userId)]
  if (!cart) return
  mutate(() => {
    for (const bought of purchased) {
      const item = cart.items.find((candidate) => candidate.nftId === bought.nftId && candidate.editionId === bought.editionId)
      if (item) item.quantity -= bought.quantity
    }
    cart.items = cart.items.filter((item) => item.quantity > 0)
    if (cart.items.length === 0) cart.couponCode = null
    touch(cart)
  })
}
