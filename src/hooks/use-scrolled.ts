import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void) {
  window.addEventListener('scroll', callback, { passive: true })
  return () => window.removeEventListener('scroll', callback)
}

/** Indica se a página rolou além de `threshold` px. Só renderiza de novo quando o valor muda. */
export function useScrolled(threshold = 8) {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > threshold,
    () => false,
  )
}
