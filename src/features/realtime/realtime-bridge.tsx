/**
 * Conecta o socket à sessão atual e aplica os eventos no cache do TanStack Query.
 * Eventos nunca escrevem diretamente na UI: atualizam o cache (patch com versão)
 * ou invalidam consultas para reconciliar com a API REST.
 */
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { queryKeys } from '@/api/query-keys'
import type { Cart, NftDetail, NftListResponse, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/shared/contracts'
import { formatEth } from '@/shared/eth'
import { announce } from '@/lib/announcer'
import { cartNotices } from '@/features/cart/cart-notices'
import { cartScope, sessionStore } from '@/features/session/session-store'
import { useSession } from '@/features/session/use-session'
import { realtimeClient, type ConnectionStatus } from './realtime-client'

function applyNftEvent(queryClient: QueryClient, event: NftUpdatedEvent) {
  const { id } = event.resource
  const patch = {
    price: event.data.price,
    compareAtPrice: event.data.compareAtPrice,
    available: event.data.available,
    version: event.version,
  }

  queryClient.setQueryData<NftDetail>(queryKeys.nfts.detail(id), (old) => {
    if (!old || old.version >= event.version) return old
    return {
      ...old,
      ...patch,
      editions: old.editions.map((edition) => {
        const next = event.data.editions.find((item) => item.id === edition.id)
        return next ? { ...edition, available: next.available, status: next.status } : edition
      }),
    }
  })

  queryClient.setQueriesData<NftListResponse>({ queryKey: queryKeys.nfts.lists }, (old) => {
    if (!old?.items.some((item) => item.id === id)) return old
    return { ...old, items: old.items.map((item) => (item.id === id && item.version < event.version ? { ...item, ...patch } : item)) }
  })

  const scope = cartScope()
  const cart = queryClient.getQueryData<Cart>(queryKeys.cart.detail(scope))
  const inCart = cart?.items.some((item) => item.nftId === id)
  if (inCart && event.data.reason !== 'purchase') {
    const priceChanged = event.data.price !== event.data.previousPrice
    cartNotices.push({
      id: event.id,
      nftId: id,
      name: event.data.name,
      kind: priceChanged ? 'price' : 'availability',
      previousPrice: event.data.previousPrice,
      price: event.data.price,
      available: event.data.available,
      receivedAt: Date.now(),
    })
    const message = priceChanged
      ? `O preço de ${event.data.name} mudou de ${formatEth(event.data.previousPrice)} para ${formatEth(event.data.price)} ETH. O resumo foi atualizado.`
      : `A disponibilidade de ${event.data.name} mudou. Revise as quantidades do carrinho.`
    toast.warning(message, { id: `nft-${id}` })
    announce(message)
  }
  if (inCart) void queryClient.invalidateQueries({ queryKey: queryKeys.cart.scope(scope) })
}

function applyOrderEvent(queryClient: QueryClient, event: OrderUpdatedEvent) {
  const userId = sessionStore.get()?.user.id
  // Isolamento: eventos de outro usuário (ex.: socket de sessão anterior) são ignorados.
  if (!userId || event.userId !== userId) return
  const key = queryKeys.private.order(userId, event.resource.id)
  queryClient.setQueryData<Order>(key, (old) => {
    if (!old || old.version >= event.version || old.status !== 'pending') return old
    return { ...old, ...event.data, version: event.version }
  })
  void queryClient.invalidateQueries({ queryKey: queryKeys.private.orders(userId) })
  if (event.data.status === 'confirmed') {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart.scope(cartScope()) })
  }
}

function reconcile(queryClient: QueryClient) {
  const userId = sessionStore.get()?.user.id
  void queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all })
  if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.private.orders(userId) })
}

export function RealtimeBridge() {
  const queryClient = useQueryClient()
  const session = useSession()
  const token = session?.token ?? null

  useEffect(() => {
    realtimeClient.setHandlers({
      onNftUpdated: (event) => applyNftEvent(queryClient, event),
      onOrderUpdated: (event) => applyOrderEvent(queryClient, event),
      onReconnected: () => reconcile(queryClient),
    })
  }, [queryClient])

  useEffect(() => {
    void realtimeClient.connect(token)
    return () => realtimeClient.disconnect()
  }, [token])

  return null
}

/** Assina um tópico enquanto o componente estiver montado. */
export function useRealtimeTopic(topic: string | null) {
  useEffect(() => {
    if (!topic) return
    return realtimeClient.subscribe(topic)
  }, [topic])
}

export function useRealtimeStatus(): ConnectionStatus {
  return useSyncExternalStore(
    (listener) => realtimeClient.onStatus(listener),
    () => realtimeClient.getStatus(),
    () => realtimeClient.getStatus(),
  )
}
