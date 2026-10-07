import type { NetworkId, WalletProvider, WalletRole } from '@/shared/contracts'

/** Credenciais fictícias documentadas no README. As senhas só existem aqui e no hash do banco simulado. */
export const demoUsers = [
  {
    id: 'usr_ana',
    username: 'ana.coleciona',
    email: 'ana@kurio.dev',
    password: 'Kurio2026',
    displayName: 'Ana Ribeiro',
    ensName: 'ana-kurio',
    walletNickname: 'Cofre principal',
    favorites: ['emerald-ape-042', 'neon-vessel-552'],
  },
  {
    id: 'usr_bruno',
    username: 'bruno.nft',
    email: 'bruno@kurio.dev',
    password: 'Kurio2026',
    displayName: 'Bruno Lima',
    ensName: 'bruno-lima',
    walletNickname: 'Carteira do Bruno',
    favorites: ['golden-beat-207'],
  },
] as const

export interface WalletFixture {
  id: string
  userId: string
  role: WalletRole
  displayName: string
  nickname: string
  network: NetworkId
  profileName: string
  address: string
  secondaryAddress: string
  provider: WalletProvider
  referralCode: string
  email: string
  ensName: string
}

export const demoWallets: WalletFixture[] = [
  {
    id: 'wal_ana_primary',
    userId: 'usr_ana',
    role: 'primary',
    displayName: 'Ana Ribeiro',
    nickname: 'Principal',
    network: 'ethereum',
    profileName: 'Ana Coleciona',
    address: '0xA91F3c2B7d4E5f60718293a4B5c6D7e8F901E82C',
    secondaryAddress: '',
    provider: 'metamask',
    referralCode: 'KURIO-ANA',
    email: 'ana@kurio.dev',
    ensName: 'ana-kurio',
  },
  {
    id: 'wal_ana_secondary',
    userId: 'usr_ana',
    role: 'secondary',
    displayName: 'Ana Ribeiro',
    nickname: 'Reserva',
    network: 'polygon',
    profileName: 'Ana Reserva',
    address: '0x5B1e2C3d4E5F60718293A4b5C6d7E8f90A1B2c3D',
    secondaryAddress: 'nova.kurio.eth',
    provider: 'coinbase',
    referralCode: 'KURIO-ANA',
    email: 'ana@kurio.dev',
    ensName: 'nova-kurio',
  },
]

export interface CouponFixture {
  code: string
  label: string
  kind: 'percent' | 'fixed'
  /** basis points para percentuais; valor em ETH para descontos fixos */
  value: string
  validUntil: string | null
  minSubtotal?: string
}

export const coupons: CouponFixture[] = [
  { code: 'KURIO10', label: '10% de desconto no lançamento', kind: 'percent', value: '1000', validUntil: null },
  { code: 'GENESIS', label: '0.05 ETH de desconto gênesis', kind: 'fixed', value: '0.05', validUntil: null, minSubtotal: '0.5' },
  { code: 'VERAO25', label: '25% de desconto de verão', kind: 'percent', value: '2500', validUntil: '2026-03-20T23:59:59.000Z' },
]
