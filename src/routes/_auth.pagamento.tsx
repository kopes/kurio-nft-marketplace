import { createFileRoute } from '@tanstack/react-router'
import { CheckoutPage } from '@/features/checkout/checkout-page'

export const Route = createFileRoute('/_auth/pagamento')({
  head: () => ({ meta: [{ title: 'Pagamento — Kurio' }, { name: 'robots', content: 'noindex' }] }),
  component: CheckoutPage,
})
