/**
 * Anúncios para leitores de tela (aria-live). Usado em mutations e alterações em tempo real
 * que não deslocam o foco do usuário.
 */
type Politeness = 'polite' | 'assertive'
type Listener = (message: string, politeness: Politeness) => void

const listeners = new Set<Listener>()

export function announce(message: string, politeness: Politeness = 'polite') {
  for (const listener of listeners) listener(message, politeness)
}

export function onAnnounce(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
