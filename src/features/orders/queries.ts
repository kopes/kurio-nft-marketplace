import { useQuery } from '@tanstack/react-query'
import { ordersApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { useSession } from '@/features/session/use-session'
import { realtimeClient } from '@/features/realtime/realtime-client'

/**
 * Estado do pedido: atualizado por `order.updated` (Socket.IO) e, como garantia,
 * revalidado periodicamente enquanto estiver pendente (inclusive após reconexão/refresh).
 */
export function useOrder(orderId: string) {
  const userId = useSession()?.user.id ?? 'anonymous'
  return useQuery({
    queryKey: queryKeys.private.order(userId, orderId),
    queryFn: async ({ signal }) => {
      const order = await ordersApi.get(orderId, { signal })
      realtimeClient.observeVersion(`order:${order.id}`, order.version)
      return order
    },
    enabled: userId !== 'anonymous',
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5_000 : false),
    retry: (count, error) => ![403, 404].includes((error as { status?: number }).status ?? 0) && count < 2,
  })
}

export function usePendingOrders() {
  const userId = useSession()?.user.id ?? 'anonymous'
  return useQuery({
    queryKey: [...queryKeys.private.orders(userId), 'pending'],
    queryFn: ({ signal }) => ordersApi.list({ status: 'pending' }, { signal }),
    enabled: userId !== 'anonymous',
  })
}
