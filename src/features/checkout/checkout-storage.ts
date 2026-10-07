/**
 * Persistência local do checkout:
 *  - rascunho do formulário (por usuário) para retomar após expiração de sessão;
 *  - tentativa de pedido em andamento (chave de idempotência + hash do conteúdo), que
 *    permite repetir o envio após timeout/refresh sem criar outro pedido.
 */
import type { CollectorInput } from '@/shared/contracts'
import { createId, readStorage, writeStorage } from '@/lib/storage'

const draftKey = (userId: string) => `kurio.checkout.draft.${userId}`
const attemptKey = (userId: string) => `kurio.checkout.attempt.${userId}`

export type CheckoutDraft = Partial<CollectorInput> & { useOtherWallet?: boolean; walletId?: string }

export function loadCheckoutDraft(userId: string) {
  return readStorage<CheckoutDraft>(draftKey(userId), 'session')
}

export function saveCheckoutDraft(userId: string, draft: CheckoutDraft) {
  writeStorage(draftKey(userId), draft, 'session')
}

export function clearCheckoutDraft(userId: string) {
  writeStorage(draftKey(userId), null, 'session')
  writeStorage(attemptKey(userId), null)
}

export interface CheckoutAttempt {
  idempotencyKey: string
  payloadHash: string
  orderId: string | null
  createdAt: number
}

export function loadAttempt(userId: string) {
  return readStorage<CheckoutAttempt>(attemptKey(userId))
}

export function saveAttempt(userId: string, attempt: CheckoutAttempt | null) {
  writeStorage(attemptKey(userId), attempt)
}

/** Reutiliza a chave enquanto o conteúdo do pedido for o mesmo; conteúdo novo gera nova chave. */
export function attemptFor(userId: string, payloadHash: string): CheckoutAttempt {
  const existing = loadAttempt(userId)
  if (existing && existing.payloadHash === payloadHash && !existing.orderId) return existing
  const attempt = { idempotencyKey: createId('order'), payloadHash, orderId: null, createdAt: Date.now() }
  saveAttempt(userId, attempt)
  return attempt
}

export function hashPayload(value: unknown) {
  const text = JSON.stringify(value)
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0
  return (hash >>> 0).toString(16)
}
