/**
 * Aritmética de valores em ETH sem ponto flutuante.
 *
 * Valores trafegam como strings decimais ("1.19", "0.016") e são convertidos para
 * bigint em wei (18 casas) para qualquer cálculo. Assim, 0.1 + 0.2 resulta exatamente
 * em "0.3" e a apresentação nunca perde precisão.
 */

export const ETH_DECIMALS = 18
const SCALE = 10n ** BigInt(ETH_DECIMALS)
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

export type EthString = string

export function isEthString(value: unknown): value is EthString {
  return typeof value === 'string' && DECIMAL_PATTERN.test(value) && fractionLength(value) <= ETH_DECIMALS
}

function fractionLength(value: string) {
  const dot = value.indexOf('.')
  return dot === -1 ? 0 : value.length - dot - 1
}

export function toWei(value: EthString): bigint {
  if (!isEthString(value)) throw new Error(`Valor ETH inválido: ${value}`)
  const negative = value.startsWith('-')
  const unsigned = negative ? value.slice(1) : value
  const [whole, fraction = ''] = unsigned.split('.')
  const wei = BigInt(whole) * SCALE + BigInt(fraction.padEnd(ETH_DECIMALS, '0'))
  return negative ? -wei : wei
}

/** Converte wei para string decimal canônica, sem zeros à direita ("1.5", "0", "26.846"). */
export function fromWei(wei: bigint): EthString {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const whole = abs / SCALE
  const fraction = (abs % SCALE).toString().padStart(ETH_DECIMALS, '0').replace(/0+$/, '')
  const result = fraction ? `${whole}.${fraction}` : `${whole}`
  return negative && abs !== 0n ? `-${result}` : result
}

export function addEth(...values: EthString[]): EthString {
  return fromWei(values.reduce((total, value) => total + toWei(value), 0n))
}

export function subEth(a: EthString, b: EthString): EthString {
  return fromWei(toWei(a) - toWei(b))
}

export function mulEth(value: EthString, quantity: number): EthString {
  if (!Number.isInteger(quantity)) throw new Error('Quantidades devem ser inteiras')
  return fromWei(toWei(value) * BigInt(quantity))
}

/** Aplica percentual em basis points (1000 = 10%), arredondando para baixo no wei. */
export function percentOfEth(value: EthString, basisPoints: number): EthString {
  return fromWei((toWei(value) * BigInt(basisPoints)) / 10_000n)
}

export function compareEth(a: EthString, b: EthString): -1 | 0 | 1 {
  const diff = toWei(a) - toWei(b)
  return diff === 0n ? 0 : diff > 0n ? 1 : -1
}

export function minEth(a: EthString, b: EthString): EthString {
  return compareEth(a, b) <= 0 ? a : b
}

export function maxEth(a: EthString, b: EthString): EthString {
  return compareEth(a, b) >= 0 ? a : b
}

export function isZeroEth(value: EthString) {
  return toWei(value) === 0n
}

/**
 * Formata para exibição mantendo todas as casas significativas
 * (mínimo de duas): "1.19", "26.846", "0.016", "2.50".
 */
export function formatEth(value: EthString, { minDecimals = 2 }: { minDecimals?: number } = {}): string {
  const canonical = fromWei(toWei(value))
  const [whole, fraction = ''] = canonical.split('.')
  return `${whole}.${fraction.padEnd(minDecimals, '0')}`
}
