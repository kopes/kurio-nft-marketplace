/** PRNG determinístico (mulberry32) para fixtures e latências reproduzíveis. */
export function createRandom(seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int(min: number, max: number) {
      return Math.floor(next() * (max - min + 1)) + min
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)]
    },
    chance(probability: number) {
      return next() < probability
    },
  }
}

/** Hash síncrono (cyrb53) usado para ids de cotação, hashes de transação e latência por URL. */
export function hashString(input: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export function hexHash(input: string, length = 16) {
  let out = ''
  let round = 0
  while (out.length < length) {
    out += hashString(input, round++).toString(16).padStart(14, '0')
  }
  return out.slice(0, length)
}
