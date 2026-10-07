/**
 * Senhas nunca são armazenadas em claro: o banco simulado guarda apenas
 * PBKDF2-SHA256 (salt por usuário) calculado com WebCrypto.
 */
const ITERATIONS = 10_000

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function randomSalt() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toHex(bytes.buffer)
}

export async function hashPassword(password: string, salt = randomSalt()) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS },
    key,
    256,
  )
  return { hash: toHex(bits), salt }
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const { hash } = await hashPassword(password, salt)
  return hash === expectedHash
}

export function randomToken(prefix: string) {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return `${prefix}_${toHex(bytes.buffer)}`
}
