import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cartApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import type { AddCartItemInput, Cart, NetworkId } from '@/shared/contracts'
import { mulEth } from '@/shared/eth'
import { announce } from '@/lib/announcer'
import { cartScope } from '@/features/session/session-store'
import { useSession } from '@/features/session/use-session'

export function useCartScope() {
  const session = useSession()
  return cartScope(session)
}

export function useCart() {
  const scope = useCartScope()
  return useQuery({
    queryKey: queryKeys.cart.detail(scope),
    queryFn: ({ signal }) => cartApi.get({ signal }),
  })
}

/** Cotação calculada pela API para o carrinho atual (subtotal, desconto, taxa e total). */
export function useQuote(network: NetworkId, context: 'cart' | 'checkout', enabled = true) {
  const scope = useCartScope()
  const cart = useCart()
  const version = cart.data?.version ?? 0
  return useQuery({
    queryKey: queryKeys.cart.quote(scope, network, version, context),
    queryFn: ({ signal }) => cartApi.quote(network, context, { signal }),
    enabled: enabled && Boolean(cart.data),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
}

function useCartMutationBase() {
  const queryClient = useQueryClient()
  const scope = useCartScope()
  const key = queryKeys.cart.detail(scope)
  const setCart = (cart: Cart) => {
    queryClient.setQueryData(key, cart)
    // Novas versões do carrinho geram nova chave de cotação; versões antigas são descartadas.
    void queryClient.invalidateQueries({ queryKey: [...queryKeys.cart.scope(scope), 'quote'] })
  }
  return { queryClient, scope, key, setCart }
}

export function useAddToCart() {
  const { setCart } = useCartMutationBase()
  return useMutation({
    mutationFn: (input: AddCartItemInput & { name: string }) => cartApi.addItem({ nftId: input.nftId, editionId: input.editionId, quantity: input.quantity }),
    onSuccess: (cart, input) => {
      setCart(cart)
      const message = `${input.quantity}× ${input.name} adicionado ao carrinho.`
      toast.success(message)
      announce(message)
    },
    onError: (error) => {
      const message = toApiError(error).message
      toast.error(message)
      announce(message, 'assertive')
    },
  })
}

/** Alteração de quantidade com atualização otimista e rollback em caso de erro. */
export function useUpdateCartItem() {
  const { queryClient, key, setCart } = useCartMutationBase()
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number; name: string }) => cartApi.updateItem(itemId, quantity),
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Cart>(key)
      if (previous) {
        queryClient.setQueryData<Cart>(key, {
          ...previous,
          items: previous.items.map((item) => (item.id === itemId ? { ...item, quantity, lineTotal: mulEth(item.unitPrice, quantity) } : item)),
        })
      }
      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      const message = toApiError(error).message
      toast.error(message)
      announce(message, 'assertive')
    },
    onSuccess: (cart, { quantity, name }) => {
      setCart(cart)
      announce(`Quantidade de ${name} atualizada para ${quantity}.`)
    },
  })
}

export function useRemoveCartItem() {
  const { setCart } = useCartMutationBase()
  return useMutation({
    mutationFn: ({ itemId }: { itemId: string; name: string }) => cartApi.removeItem(itemId),
    onSuccess: (cart, { name }) => {
      setCart(cart)
      const message = `${name} removido do carrinho.`
      toast.success(message)
      announce(message)
    },
    onError: (error) => {
      const message = toApiError(error).message
      toast.error(message)
      announce(message, 'assertive')
    },
  })
}

export function useApplyCoupon() {
  const { setCart } = useCartMutationBase()
  return useMutation({
    mutationFn: (code: string) => cartApi.applyCoupon(code),
    onSuccess: (cart) => {
      setCart(cart)
      announce(`Código ${cart.couponCode} aplicado.`)
    },
  })
}

export function useRemoveCoupon() {
  const { setCart } = useCartMutationBase()
  return useMutation({
    mutationFn: () => cartApi.removeCoupon(),
    onSuccess: (cart) => {
      setCart(cart)
      announce('Código promocional removido.')
    },
    onError: (error) => toast.error(toApiError(error).message),
  })
}
