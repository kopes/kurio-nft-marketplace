import { useSyncExternalStore } from 'react'
import { sessionStore } from './session-store'

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

export function useCurrentUserId() {
  return useSession()?.user.id ?? null
}
