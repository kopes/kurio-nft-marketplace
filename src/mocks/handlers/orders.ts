import { delay, http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/shared/config'
import { CreateOrderInput } from '@/shared/contracts'
import { db } from '../db'
import { ApiFailure, handle, readJson, requireAuth } from '../lib/http'
import { currentScenario } from '../scenarios'
import { createOrder, findOrderForUser, resumePendingOrders, toOrderDto } from '../services/orders'

/** Atraso aplicado à primeira resposta no cenário "order-timeout" (o cliente desiste em 8 s). */
export const ORDER_TIMEOUT_DELAY_MS = 12_000
let timeoutTriggered = false

export function resetOrderScenarioFlags() {
  timeoutTriggered = false
}

export const orderHandlers = [
  http.post(
    `${API_BASE_URL}/orders`,
    handle(async ({ request }) => {
      const { user } = requireAuth(request)
      const key = request.headers.get('idempotency-key')
      if (!key || key.length < 8 || key.length > 128) {
        throw new ApiFailure(422, 'VALIDATION_ERROR', 'Cabeçalho Idempotency-Key obrigatório.')
      }
      const input = await readJson(request, CreateOrderInput)
      const { order, replayed } = createOrder(user.id, input, key)

      if (!replayed && currentScenario().orderTimeout && !timeoutTriggered) {
        timeoutTriggered = true
        // O pedido já existe; a resposta chega depois do timeout do cliente.
        await delay(ORDER_TIMEOUT_DELAY_MS)
      }
      return HttpResponse.json(toOrderDto(order), {
        status: replayed ? 200 : 201,
        headers: replayed ? { 'Idempotent-Replayed': 'true' } : undefined,
      })
    }),
  ),

  http.get(
    `${API_BASE_URL}/orders`,
    handle(({ request }) => {
      const { user } = requireAuth(request)
      resumePendingOrders()
      const url = new URL(request.url)
      const status = url.searchParams.get('status')
      const key = url.searchParams.get('idempotencyKey')
      const items = db()
        .orders.filter((order) => order.userId === user.id && (!status || order.status === status) && (!key || order.idempotencyKey === key))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toOrderDto)
      return HttpResponse.json({ items })
    }),
  ),

  http.get(
    `${API_BASE_URL}/orders/:orderId`,
    handle(({ request, params }) => {
      const { user } = requireAuth(request)
      resumePendingOrders()
      return HttpResponse.json(toOrderDto(findOrderForUser(String(params.orderId), user.id)))
    }),
  ),
]
