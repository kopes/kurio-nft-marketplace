/**
 * Contratos REST e de eventos compartilhados entre o cliente (Axios + TanStack Query)
 * e a API simulada (MSW). Os schemas validam as respostas em tempo de execução no cliente
 * e as entradas nos handlers, garantindo que transporte, estado e interface usem os mesmos tipos.
 */
import { z } from 'zod'
import { isEthString } from './eth'

// ---------------------------------------------------------------------------
// Primitivos
// ---------------------------------------------------------------------------

export const ethAmount = z.string().refine(isEthString, 'Valor ETH inválido')

export const networkIds = ['ethereum', 'polygon', 'solana'] as const
export const NetworkId = z.enum(networkIds)
export type NetworkId = z.infer<typeof NetworkId>

export const networkLabels: Record<NetworkId, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const collectionIds = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
] as const
export const CollectionId = z.enum(collectionIds)
export type CollectionId = z.infer<typeof CollectionId>

export const collectionLabels: Record<CollectionId, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const EditionId = z.enum(['1-1', '1-10', '1-50', 'aberta'])
export type EditionId = z.infer<typeof EditionId>

export const ArtworkId = z.enum(['emerald', 'sage', 'ivory', 'golden'])
export type ArtworkId = z.infer<typeof ArtworkId>

export const catalogTabs = ['todos', 'novos', 'em-alta'] as const
export const CatalogTab = z.enum(catalogTabs)
export type CatalogTab = z.infer<typeof CatalogTab>

export const catalogSorts = ['recentes', 'menor-preco', 'maior-preco', 'nome'] as const
export const CatalogSort = z.enum(catalogSorts)
export type CatalogSort = z.infer<typeof CatalogSort>

export const walletProviders = ['metamask', 'walletconnect', 'coinbase'] as const
export const WalletProvider = z.enum(walletProviders)
export type WalletProvider = z.infer<typeof WalletProvider>

export const walletProviderLabels: Record<WalletProvider, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

export const errorCodes = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'EDITION_UNAVAILABLE',
  'OUT_OF_STOCK',
  'QUANTITY_LIMIT',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'CART_EMPTY',
  'QUOTE_CHANGED',
  'IDEMPOTENCY_CONFLICT',
  'WALLET_REJECTED',
  'WALLET_DISCONNECTED',
  'WALLET_ROLE_TAKEN',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const
export const ErrorCode = z.enum(errorCodes)
export type ErrorCode = z.infer<typeof ErrorCode>

export const ApiErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    fieldErrors: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof ApiErrorBody>

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const EditionStatus = z.enum(['available', 'sold_out', 'unavailable'])
export type EditionStatus = z.infer<typeof EditionStatus>

export const Edition = z.object({
  id: EditionId,
  label: z.string(),
  supply: z.number().int().nullable(),
  available: z.number().int().nonnegative(),
  maxPerOrder: z.number().int().positive(),
  status: EditionStatus,
})
export type Edition = z.infer<typeof Edition>

export const NftSummary = z.object({
  id: z.string(),
  name: z.string(),
  tokenId: z.string(),
  artwork: ArtworkId,
  collection: CollectionId,
  collectionName: z.string(),
  network: NetworkId,
  price: ethAmount,
  compareAtPrice: ethAmount.nullable(),
  rarity: z.enum(['raro', 'lendario']).nullable(),
  isNewRelease: z.boolean(),
  available: z.number().int().nonnegative(),
  listedAt: z.string(),
  version: z.number().int(),
})
export type NftSummary = z.infer<typeof NftSummary>

export const Review = z.object({
  id: z.string(),
  author: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
  createdAt: z.string(),
})
export type Review = z.infer<typeof Review>

export const NftDetail = NftSummary.extend({
  description: z.string(),
  story: z.array(z.string()),
  attributes: z.array(z.string()),
  rating: z.number(),
  reviewsCount: z.number().int(),
  editions: z.array(Edition),
  contractAddress: z.string(),
  royaltyPercent: z.number(),
  creator: z.string(),
  gallery: z.array(ArtworkId),
  reviews: z.array(Review),
})
export type NftDetail = z.infer<typeof NftDetail>

export const FacetOption = z.object({ id: z.string(), label: z.string(), count: z.number().int() })
export type FacetOption = z.infer<typeof FacetOption>

export const NftListResponse = z.object({
  items: z.array(NftSummary),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  facets: z.object({
    collections: z.array(FacetOption),
    networks: z.array(FacetOption),
    price: z.object({ min: ethAmount, max: ethAmount }),
  }),
})
export type NftListResponse = z.infer<typeof NftListResponse>

export interface NftListParams {
  q?: string
  collections?: CollectionId[]
  networks?: NetworkId[]
  minPrice?: string
  maxPrice?: string
  tab?: CatalogTab
  sort?: CatalogSort
  page?: number
  pageSize?: number
  exclude?: string
}

// ---------------------------------------------------------------------------
// Sessão e conta
// ---------------------------------------------------------------------------

export const User = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof User>

export const Session = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: User,
})
export type Session = z.infer<typeof Session>

export const SessionInfo = z.object({ expiresAt: z.string(), user: User })
export type SessionInfo = z.infer<typeof SessionInfo>

const password = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .max(64, 'A senha deve ter no máximo 64 caracteres')
  .regex(/[A-Za-z]/, 'Inclua pelo menos uma letra')
  .regex(/\d/, 'Inclua pelo menos um número')

const email = z.string().trim().min(1, 'Informe seu e-mail').email('Informe um e-mail válido')

const username = z
  .string()
  .trim()
  .min(3, 'Use pelo menos 3 caracteres')
  .max(20, 'Use no máximo 20 caracteres')
  .regex(/^[a-zA-Z0-9_.]+$/, 'Use apenas letras, números, ponto e sublinhado')

const displayName = z.string().trim().min(2, 'Informe o nome de exibição').max(40, 'Use no máximo 40 caracteres')

const ensName = z
  .string()
  .trim()
  .min(3, 'Informe o nome ENS (mínimo 3 caracteres)')
  .max(32, 'Use no máximo 32 caracteres')
  .regex(/^[a-z0-9-]+$/, 'Use letras minúsculas, números e hífen')

export const LoginInput = z.object({
  email,
  password: z.string().min(1, 'Informe sua senha'),
})
export type LoginInput = z.infer<typeof LoginInput>

export const RegisterInput = z
  .object({
    username,
    email,
    password,
    confirmPassword: z.string().min(1, 'Confirme sua senha'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })
export type RegisterInput = z.infer<typeof RegisterInput>

export const Profile = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  displayName: z.string(),
  ensName: z.string(),
  walletNickname: z.string(),
  avatarUrl: z.string().nullable(),
  updatedAt: z.string(),
  version: z.number().int(),
})
export type Profile = z.infer<typeof Profile>

export const ProfileUpdateInput = z.object({
  displayName,
  username,
  email,
  ensName,
  walletNickname: z.string().trim().min(2, 'Informe o apelido da carteira').max(32, 'Use no máximo 32 caracteres'),
})
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateInput>

export const PasswordChangeInput = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: password,
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  })
export type PasswordChangeInput = z.infer<typeof PasswordChangeInput>

export const AVATAR_MAX_BYTES = 1_000_000
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

// ---------------------------------------------------------------------------
// Carteiras
// ---------------------------------------------------------------------------

export const WalletRole = z.enum(['primary', 'secondary'])
export type WalletRole = z.infer<typeof WalletRole>

const evmAddress = /^0x[a-fA-F0-9]{40}$/
const solanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function isValidAddress(network: NetworkId, address: string) {
  return network === 'solana' ? solanaAddress.test(address) : evmAddress.test(address)
}

export const WalletInput = z
  .object({
    role: WalletRole,
    displayName,
    nickname: z.string().trim().min(2, 'Informe o apelido da carteira').max(32, 'Use no máximo 32 caracteres'),
    network: NetworkId,
    profileName: z.string().trim().min(2, 'Informe o nome do perfil').max(40, 'Use no máximo 40 caracteres'),
    address: z.string().trim().min(1, 'Informe o endereço da carteira'),
    secondaryAddress: z.string().trim().max(64, 'Use no máximo 64 caracteres').optional().default(''),
    provider: WalletProvider,
    referralCode: z
      .string()
      .trim()
      .min(1, 'Informe o código de indicação')
      .regex(/^[A-Za-z0-9-]{4,16}$/, 'Use de 4 a 16 letras, números ou hífen'),
    email,
    ensName,
  })
  .superRefine((value, ctx) => {
    if (value.address && !isValidAddress(value.network, value.address)) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message:
          value.network === 'solana'
            ? 'Endereço Solana inválido (base58, 32 a 44 caracteres)'
            : 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais',
      })
    }
  })
export type WalletInput = z.input<typeof WalletInput>

export const Wallet = z.object({
  id: z.string(),
  role: WalletRole,
  displayName: z.string(),
  nickname: z.string(),
  network: NetworkId,
  profileName: z.string(),
  address: z.string(),
  secondaryAddress: z.string(),
  provider: WalletProvider,
  referralCode: z.string(),
  email: z.string(),
  ensName: z.string(),
  updatedAt: z.string(),
  version: z.number().int(),
})
export type Wallet = z.infer<typeof Wallet>

export const WalletsResponse = z.object({ items: z.array(Wallet) })
export type WalletsResponse = z.infer<typeof WalletsResponse>

export const WalletConnection = z.object({
  id: z.string(),
  provider: WalletProvider,
  network: NetworkId,
  address: z.string(),
  status: z.enum(['connected', 'disconnected']),
  connectedAt: z.string(),
})
export type WalletConnection = z.infer<typeof WalletConnection>

export const WalletConnectInput = z.object({
  provider: WalletProvider,
  network: NetworkId,
  address: z.string(),
})
export type WalletConnectInput = z.infer<typeof WalletConnectInput>

// ---------------------------------------------------------------------------
// Favoritos
// ---------------------------------------------------------------------------

export const FavoritesResponse = z.object({ items: z.array(z.string()) })
export type FavoritesResponse = z.infer<typeof FavoritesResponse>

// ---------------------------------------------------------------------------
// Carrinho e cotação
// ---------------------------------------------------------------------------

export const CartItemIssue = z.enum(['PRICE_CHANGED', 'INSUFFICIENT_STOCK', 'SOLD_OUT', 'UNAVAILABLE'])
export type CartItemIssue = z.infer<typeof CartItemIssue>

export const CartItem = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: EditionId,
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  artwork: ArtworkId,
  network: NetworkId,
  quantity: z.number().int().positive(),
  unitPrice: ethAmount,
  lineTotal: ethAmount,
  previousUnitPrice: ethAmount.nullable(),
  available: z.number().int().nonnegative(),
  maxQuantity: z.number().int().nonnegative(),
  issue: CartItemIssue.nullable(),
  nftVersion: z.number().int(),
})
export type CartItem = z.infer<typeof CartItem>

export const Cart = z.object({
  id: z.string(),
  owner: z.enum(['guest', 'user']),
  items: z.array(CartItem),
  couponCode: z.string().nullable(),
  itemCount: z.number().int(),
  totalQuantity: z.number().int(),
  version: z.number().int(),
  updatedAt: z.string(),
})
export type Cart = z.infer<typeof Cart>

export const AddCartItemInput = z.object({
  nftId: z.string(),
  editionId: EditionId,
  quantity: z.number().int().min(1, 'Quantidade mínima é 1'),
})
export type AddCartItemInput = z.infer<typeof AddCartItemInput>

export const UpdateCartItemInput = z.object({ quantity: z.number().int().min(1, 'Quantidade mínima é 1') })
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemInput>

export const CouponInput = z.object({
  code: z.string().trim().min(1, 'Informe o código promocional').max(24, 'Código muito longo'),
})
export type CouponInput = z.infer<typeof CouponInput>

export const MergeCartInput = z.object({ guestCartId: z.string() })

export const Coupon = z.object({
  code: z.string(),
  label: z.string(),
  kind: z.enum(['percent', 'fixed']),
  value: z.string(),
})
export type Coupon = z.infer<typeof Coupon>

export const QuoteItem = z.object({
  cartItemId: z.string(),
  nftId: z.string(),
  editionId: EditionId,
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  artwork: ArtworkId,
  quantity: z.number().int(),
  unitPrice: ethAmount,
  lineTotal: ethAmount,
})
export type QuoteItem = z.infer<typeof QuoteItem>

export const QuoteIssue = z.object({
  cartItemId: z.string(),
  nftId: z.string(),
  name: z.string(),
  code: CartItemIssue,
  message: z.string(),
})
export type QuoteIssue = z.infer<typeof QuoteIssue>

export const Quote = z.object({
  id: z.string(),
  network: NetworkId,
  currency: z.literal('ETH'),
  items: z.array(QuoteItem),
  subtotal: ethAmount,
  discount: ethAmount,
  coupon: Coupon.nullable(),
  networkFee: ethAmount,
  total: ethAmount,
  cartVersion: z.number().int(),
  issues: z.array(QuoteIssue),
  issuedAt: z.string(),
})
export type Quote = z.infer<typeof Quote>

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export const OrderStatus = z.enum(['pending', 'confirmed', 'declined'])
export type OrderStatus = z.infer<typeof OrderStatus>

export const CollectorInput = z.object({
  displayName,
  username,
  network: NetworkId,
  profileName: z.string().trim().min(2, 'Informe o nome do perfil').max(40, 'Use no máximo 40 caracteres'),
  walletAddress: z.string().trim().min(1, 'Informe o endereço da carteira'),
  secondaryAddress: z.string().trim().max(64, 'Use no máximo 64 caracteres').optional().default(''),
  walletProvider: WalletProvider,
  referralCode: z
    .string()
    .trim()
    .min(1, 'Informe o código de indicação')
    .regex(/^[A-Za-z0-9-]{4,16}$/, 'Use de 4 a 16 letras, números ou hífen'),
  email,
  ensName,
  note: z.string().trim().max(280, 'Use no máximo 280 caracteres').optional().default(''),
})
export type CollectorInput = z.input<typeof CollectorInput>

export const CollectorSchema = CollectorInput.superRefine((value, ctx) => {
  if (value.walletAddress && !isValidAddress(value.network, value.walletAddress)) {
    ctx.addIssue({
      code: 'custom',
      path: ['walletAddress'],
      message:
        value.network === 'solana'
          ? 'Endereço Solana inválido (base58, 32 a 44 caracteres)'
          : 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais',
    })
  }
})

export const CreateOrderInput = z.object({
  quoteId: z.string(),
  walletConnectionId: z.string(),
  collector: CollectorSchema,
})
export type CreateOrderInput = z.input<typeof CreateOrderInput>

export const OrderItem = z.object({
  nftId: z.string(),
  editionId: EditionId,
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  artwork: ArtworkId,
  quantity: z.number().int(),
  unitPrice: ethAmount,
  lineTotal: ethAmount,
})
export type OrderItem = z.infer<typeof OrderItem>

export const Order = z.object({
  id: z.string(),
  status: OrderStatus,
  declineReason: z.string().nullable(),
  quoteId: z.string(),
  network: NetworkId,
  items: z.array(OrderItem),
  subtotal: ethAmount,
  discount: ethAmount,
  couponCode: z.string().nullable(),
  networkFee: ethAmount,
  total: ethAmount,
  wallet: z.object({ provider: WalletProvider, address: z.string() }),
  collector: z.object({ displayName: z.string(), username: z.string(), email: z.string(), ensName: z.string() }),
  transaction: z.object({ hash: z.string(), blockNumber: z.number().int().nullable() }).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  confirmedAt: z.string().nullable(),
  version: z.number().int(),
})
export type Order = z.infer<typeof Order>

export const OrdersResponse = z.object({ items: z.array(Order) })

// ---------------------------------------------------------------------------
// Eventos em tempo real (Socket.IO)
// ---------------------------------------------------------------------------

export const NftUpdatedEvent = z.object({
  id: z.string(),
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: z.string() }),
  version: z.number().int(),
  occurredAt: z.string(),
  data: z.object({
    name: z.string(),
    price: ethAmount,
    previousPrice: ethAmount,
    compareAtPrice: ethAmount.nullable(),
    available: z.number().int(),
    editions: z.array(Edition.pick({ id: true, available: true, status: true })),
    reason: z.enum(['price', 'availability', 'purchase']),
  }),
})
export type NftUpdatedEvent = z.infer<typeof NftUpdatedEvent>

export const OrderUpdatedEvent = z.object({
  id: z.string(),
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: z.string() }),
  version: z.number().int(),
  occurredAt: z.string(),
  userId: z.string(),
  data: z.object({
    status: OrderStatus,
    declineReason: z.string().nullable(),
    transaction: z.object({ hash: z.string(), blockNumber: z.number().int().nullable() }).nullable(),
  }),
})
export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEvent>

export const realtimeEvents = {
  nftUpdated: 'nft.updated',
  orderUpdated: 'order.updated',
  subscribe: 'subscribe',
  unsubscribe: 'unsubscribe',
  sessionReady: 'session.ready',
} as const

export interface RealtimeSubscription {
  topics: string[]
}
