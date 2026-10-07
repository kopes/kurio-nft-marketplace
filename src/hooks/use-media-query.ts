import { useSyncExternalStore } from 'react'

/** Estado de uma media query, sincronizado com `matchMedia` (sem renderização dupla). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (callback) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', callback)
      return () => list.removeEventListener('change', callback)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Abaixo do breakpoint `md` (768 px): layout dos frames mobile do Figma. */
export function useIsMobile() {
  return useMediaQuery('(max-width: 767.98px)')
}
