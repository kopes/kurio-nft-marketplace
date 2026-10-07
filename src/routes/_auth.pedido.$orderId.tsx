import { createFileRoute } from '@tanstack/react-router'
import { OrderPage } from '@/features/orders/order-page'

export const Route = createFileRoute('/_auth/pedido/$orderId')({
  head: () => ({ meta: [{ title: 'Pedido — Kurio' }, { name: 'robots', content: 'noindex' }] }),
  component: OrderRoute,
})

function OrderRoute() {
  const { orderId } = Route.useParams()
  return <OrderPage key={orderId} orderId={orderId} />
}
