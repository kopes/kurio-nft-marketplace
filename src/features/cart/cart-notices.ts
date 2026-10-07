/**
 * Avisos de alterações recebidas em tempo real para itens do carrinho
 * (preço ou disponibilidade). Exibidos no carrinho e no checkout até serem dispensados.
 */
import { useSyncExternalStore } from 'react'

export interface CartNotice {
  id: string
  nftId: string
  name: string
  kind: 'price' | 'availability'
  previousPrice: string
  price: string
  available: number
  receivedAt: number
}

let notices: CartNotice[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export const cartNotices = {
  push(notice: CartNotice) {
    notices = [notice, ...notices.filter((item) => item.nftId !== notice.nftId || item.kind !== notice.kind)].slice(0, 5)
    emit()
  },
  dismiss(id: string) {
    notices = notices.filter((item) => item.id !== id)
    emit()
  },
  clear() {
    notices = []
    emit()
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  get() {
    return notices
  },
}

export function useCartNotices() {
  return useSyncExternalStore(cartNotices.subscribe, cartNotices.get, cartNotices.get)
}
