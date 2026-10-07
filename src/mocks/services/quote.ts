import type { Coupon, NetworkId, Quote, QuoteIssue } from '@/shared/contracts'
import { addEth, compareEth, isZeroEth, minEth, percentOfEth, subEth } from '@/shared/eth'
import type { CartRecord } from '../db'
import { coupons } from '../fixtures/accounts'
import { ApiFailure } from '../lib/http'
import { hexHash } from '../lib/random'
import { toCartItemDto } from './cart'

/** Taxa de rede estimada por rede (valores em ETH). */
export const NETWORK_FEES: Record<NetworkId, string> = {
  ethereum: '0.016',
  polygon: '0.004',
  solana: '0.002',
}

const issueMessages = {
  PRICE_CHANGED: (name: string) => `O preço de ${name} foi atualizado.`,
  INSUFFICIENT_STOCK: (name: string) => `Quantidade de ${name} maior que a disponível.`,
  SOLD_OUT: (name: string) => `${name} esgotou nesta edição.`,
  UNAVAILABLE: (name: string) => `A edição selecionada de ${name} está indisponível.`,
}

export const BLOCKING_ISSUES = new Set(['INSUFFICIENT_STOCK', 'SOLD_OUT', 'UNAVAILABLE'])

/** Valida um código promocional; lança 422 com código específico para inválido ou expirado. */
export function validateCoupon(code: string, subtotal: string) {
  const coupon = coupons.find((item) => item.code === code.trim().toUpperCase())
  if (!coupon) throw new ApiFailure(422, 'COUPON_INVALID', 'Código promocional inválido.', { code: 'Código promocional inválido' })
  if (coupon.validUntil && Date.parse(coupon.validUntil) < Date.now()) {
    throw new ApiFailure(422, 'COUPON_EXPIRED', 'Este código promocional expirou.', { code: 'Código promocional expirado' })
  }
  if (coupon.minSubtotal && compareEth(subtotal, coupon.minSubtotal) < 0) {
    throw new ApiFailure(422, 'COUPON_INVALID', `Este código exige subtotal mínimo de ${coupon.minSubtotal} ETH.`, {
      code: `Subtotal mínimo de ${coupon.minSubtotal} ETH`,
    })
  }
  return coupon
}

export function computeQuote(cart: CartRecord, network: NetworkId): Quote {
  const items = cart.items.map(toCartItemDto)
  const issues: QuoteIssue[] = items
    .filter((item) => item.issue)
    .map((item) => ({ cartItemId: item.id, nftId: item.nftId, name: item.name, code: item.issue!, message: issueMessages[item.issue!](item.name) }))

  const purchasable = items.filter((item) => !item.issue || item.issue === 'PRICE_CHANGED')
  const subtotal = addEth('0', ...purchasable.map((item) => item.lineTotal))

  let coupon: Coupon | null = null
  let discount = '0'
  if (cart.couponCode && !isZeroEth(subtotal)) {
    try {
      const valid = validateCoupon(cart.couponCode, subtotal)
      coupon = { code: valid.code, label: valid.label, kind: valid.kind, value: valid.value }
      discount = valid.kind === 'percent' ? percentOfEth(subtotal, Number(valid.value)) : minEth(valid.value, subtotal)
    } catch {
      coupon = null
    }
  }

  const networkFee = purchasable.length ? NETWORK_FEES[network] : '0'
  const total = addEth(subEth(subtotal, discount), networkFee)

  const quoteItems = purchasable.map((item) => ({
    cartItemId: item.id,
    nftId: item.nftId,
    editionId: item.editionId,
    editionLabel: item.editionLabel,
    name: item.name,
    tokenId: item.tokenId,
    artwork: item.artwork,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  }))

  // O id é o hash do conteúdo: qualquer mudança de preço, quantidade, cupom ou taxa gera nova cotação.
  const fingerprint = JSON.stringify({
    items: quoteItems.map((item) => [item.nftId, item.editionId, item.quantity, item.unitPrice]),
    issues: issues.map((issue) => [issue.cartItemId, issue.code]),
    coupon: coupon?.code ?? null,
    discount,
    networkFee,
    network,
  })

  return {
    id: `q_${hexHash(fingerprint, 20)}`,
    network,
    currency: 'ETH',
    items: quoteItems,
    subtotal,
    discount,
    coupon,
    networkFee,
    total,
    cartVersion: cart.version,
    issues,
    issuedAt: new Date().toISOString(),
  }
}
