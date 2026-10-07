import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ordersApi } from '@/api/endpoints'
import { ApiError, toApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import type { CreateOrderInput, Order } from '@/shared/contracts'
import { announce } from '@/lib/announcer'
import { useSession } from '@/features/session/use-session'
import { attemptFor, hashPayload, saveAttempt } from './checkout-storage'

const MAX_ATTEMPTS = 3
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function isTransient(error: ApiError) {
  return error.kind === 'timeout' || error.kind === 'network' || (error.status !== null && error.status >= 500)
}

/**
 * Criação de pedido idempotente.
 * - A chave é derivada da tentativa (persistida): cliques repetidos, reenvios após timeout
 *   e até um refresh reutilizam a mesma chave enquanto o conteúdo for o mesmo.
 * - Falhas transitórias são repetidas automaticamente; o servidor devolve o pedido já criado.
 */
export function usePlaceOrder() {
  const queryClient = useQueryClient()
  const userId = useSession()?.user.id ?? 'anonymous'
  const [retryCount, setRetryCount] = useState(0)

  const mutation = useMutation({
    mutationKey: ['orders', 'create'],
    mutationFn: async (input: CreateOrderInput): Promise<Order> => {
      const attempt = attemptFor(userId, hashPayload(input))
      let lastError: ApiError | null = null
      for (let index = 0; index < MAX_ATTEMPTS; index++) {
        try {
          const order = await ordersApi.create(input, attempt.idempotencyKey)
          saveAttempt(userId, { ...attempt, orderId: order.id })
          return order
        } catch (error) {
          lastError = toApiError(error)
          if (!isTransient(lastError)) throw lastError
          setRetryCount(index + 1)
          announce('A rede está lenta. Verificando seu pedido sem criar uma nova compra…')
          if (index < MAX_ATTEMPTS - 1) await sleep(800 * (index + 1))
        }
      }
      throw lastError ?? new ApiError('network', 'Não foi possível enviar o pedido.')
    },
    onMutate: () => setRetryCount(0),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.private.order(userId, order.id), order)
      void queryClient.invalidateQueries({ queryKey: queryKeys.private.orders(userId) })
      announce('Pedido enviado. Aguardando confirmação na rede.')
    },
  })

  return { ...mutation, retryCount }
}
