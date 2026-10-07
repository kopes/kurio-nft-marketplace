import { createFileRoute } from '@tanstack/react-router'
import { CartPage } from '@/features/cart/cart-page'

export const Route = createFileRoute('/carrinho')({
  head: () => ({ meta: [{ title: 'Carrinho — Kurio' }, { name: 'robots', content: 'noindex' }] }),
  component: CartPage,
})
