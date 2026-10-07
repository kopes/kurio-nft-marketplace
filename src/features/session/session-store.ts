/**
 * Estado da sessão no cliente.
 *
 * O token é persistido para recuperar a sessão após refresh; a validade real é sempre
 * confirmada pela API (`GET /auth/session`). Mudanças de sessão notificam assinantes
 * (React, socket de tempo real, cache) para isolar os dados por usuário.
 */
import type { Session, User } from '@/shared/contracts'
import { createId, readStorage, writeStorage } from '@/lib/storage'

const SESSION_KEY = 'kurio.session'
const GUEST_CART_KEY = 'kurio.guest-cart-id'

export type SessionEndReason = 'logout' | 'expired' | 'switch'

type Listener = () => void
type EndListener = (reason: SessionEndReason, previous: Session) => void

let current: Session | null = readStorage<Session>(SESSION_KEY)
const listeners = new Set<Listener>()
const endListeners = new Set<EndListener>()

function emit() {
  for (const listener of listeners) listener()
}

export const sessionStore = {
  get(): Session | null {
    return current
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  onEnd(listener: EndListener) {
    endListeners.add(listener)
    return () => {
      endListeners.delete(listener)
    }
  },
  start(session: Session) {
    const previous = current
    if (previous && previous.user.id !== session.user.id) {
      for (const listener of endListeners) listener('switch', previous)
    }
    current = session
    writeStorage(SESSION_KEY, session)
    emit()
  },
  updateUser(user: User) {
    if (!current) return
    current = { ...current, user }
    writeStorage(SESSION_KEY, current)
    emit()
  },
  end(reason: SessionEndReason) {
    const previous = current
    if (!previous) return
    current = null
    writeStorage(SESSION_KEY, null)
    for (const listener of endListeners) listener(reason, previous)
    emit()
  },
}

/** Identificador do carrinho de visitante; trocado após ser mesclado ao carrinho do usuário. */
export function guestCartId() {
  let id = readStorage<string>(GUEST_CART_KEY)
  if (!id) {
    id = createId('guest')
    writeStorage(GUEST_CART_KEY, id)
  }
  return id
}

export function rotateGuestCartId() {
  const id = createId('guest')
  writeStorage(GUEST_CART_KEY, id)
  return id
}

/** Escopo de cache do carrinho: usuário autenticado ou visitante. */
export function cartScope(session: Session | null = current) {
  return session ? `user:${session.user.id}` : `guest:${guestCartId()}`
}
