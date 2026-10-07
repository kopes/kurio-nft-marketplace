import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/shared/config'
import { AddCartItemInput, CouponInput, MergeCartInput, NetworkId, UpdateCartItemInput } from '@/shared/contracts'
import { mutate } from '../db'
import { ApiFailure, handle, readJson, requireAuth } from '../lib/http'
import { currentScenario } from '../scenarios'
import { addItem, getCart, mergeGuestCart, removeItem, resolveCartOwner, toCartDto, touch, updateItem } from '../services/cart'
import { changeNftPrice } from '../services/nfts'
import { computeQuote, validateCoupon } from '../services/quote'

/** Cenário "preço muda no checkout": agenda uma única alteração por carregamento. */
let priceChangeScheduled = false

export function resetCartScenarioFlags() {
  priceChangeScheduled = false
}

export const cartHandlers = [
  http.get(
    `${API_BASE_URL}/cart`,
    handle(({ request }) => {
      const owner = resolveCartOwner(request)
      return HttpResponse.json(toCartDto(getCart(owner.key), owner.owner))
    }),
  ),

  http.post(
    `${API_BASE_URL}/cart/items`,
    handle(async ({ request }) => {
      const owner = resolveCartOwner(request)
      const input = await readJson(request, AddCartItemInput)
      const cart = getCart(owner.key)
      addItem(cart, input)
      return HttpResponse.json(toCartDto(cart, owner.owner), { status: 201 })
    }),
  ),

  http.patch(
    `${API_BASE_URL}/cart/items/:itemId`,
    handle(async ({ request, params }) => {
      const owner = resolveCartOwner(request)
      const input = await readJson(request, UpdateCartItemInput)
      const cart = getCart(owner.key)
      updateItem(cart, String(params.itemId), input.quantity)
      return HttpResponse.json(toCartDto(cart, owner.owner))
    }),
  ),

  http.delete(
    `${API_BASE_URL}/cart/items/:itemId`,
    handle(({ request, params }) => {
      const owner = resolveCartOwner(request)
      const cart = getCart(owner.key)
      removeItem(cart, String(params.itemId))
      return HttpResponse.json(toCartDto(cart, owner.owner))
    }),
  ),

  http.post(
    `${API_BASE_URL}/cart/coupon`,
    handle(async ({ request }) => {
      const owner = resolveCartOwner(request)
      const { code } = await readJson(request, CouponInput)
      const cart = getCart(owner.key)
      if (cart.items.length === 0) throw new ApiFailure(409, 'CART_EMPTY', 'Adicione itens antes de aplicar um cupom.')
      const coupon = validateCoupon(code, computeQuote(cart, 'ethereum').subtotal)
      mutate(() => {
        cart.couponCode = coupon.code
        touch(cart)
      })
      return HttpResponse.json(toCartDto(cart, owner.owner))
    }),
  ),

  http.delete(
    `${API_BASE_URL}/cart/coupon`,
    handle(({ request }) => {
      const owner = resolveCartOwner(request)
      const cart = getCart(owner.key)
      mutate(() => {
        cart.couponCode = null
        touch(cart)
      })
      return HttpResponse.json(toCartDto(cart, owner.owner))
    }),
  ),

  http.post(
    `${API_BASE_URL}/cart/merge`,
    handle(async ({ request }) => {
      const { user } = requireAuth(request)
      const { guestCartId } = await readJson(request, MergeCartInput)
      return HttpResponse.json(toCartDto(mergeGuestCart(user.id, guestCartId), 'user'))
    }),
  ),

  http.get(
    `${API_BASE_URL}/cart/quote`,
    handle(({ request }) => {
      const url = new URL(request.url)
      const owner = resolveCartOwner(request)
      const parsedNetwork = NetworkId.safeParse(url.searchParams.get('network') ?? 'ethereum')
      if (!parsedNetwork.success) throw new ApiFailure(422, 'VALIDATION_ERROR', 'Rede inválida.')
      const cart = getCart(owner.key)

      if (url.searchParams.get('context') === 'checkout' && currentScenario().priceChangeOnCheckout && !priceChangeScheduled && cart.items[0]) {
        priceChangeScheduled = true
        const nftId = cart.items[0].nftId
        setTimeout(() => changeNftPrice(nftId), 4000)
      }

      return HttpResponse.json(computeQuote(cart, parsedNetwork.data))
    }),
  ),
]
