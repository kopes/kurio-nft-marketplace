/** Acesso a storage tolerante a falhas (modo privado, cota, bloqueio de cookies). */
export function readStorage<T>(key: string, storage: 'local' | 'session' = 'local'): T | null {
  try {
    const raw = (storage === 'local' ? localStorage : sessionStorage).getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: unknown, storage: 'local' | 'session' = 'local') {
  try {
    const target = storage === 'local' ? localStorage : sessionStorage
    if (value === null || value === undefined) target.removeItem(key)
    else target.setItem(key, JSON.stringify(value))
  } catch {
    // Persistência é conveniência: a aplicação segue funcionando em memória.
  }
}

export function createId(prefix = '') {
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return prefix ? `${prefix}-${id}` : id
}
