/**
 * Funções de acesso aos recursos REST. Cada função tipa entrada e saída pelos contratos
 * compartilhados e aceita `signal` para cancelamento de consultas obsoletas.
 */
import {
  Cart,
  FavoritesResponse,
  NftDetail,
  NftListResponse,
  Order,
  OrdersResponse,
  Profile,
  Quote,
  Session,
  SessionInfo,
  Wallet,
  WalletConnection,
  WalletsResponse,
  type AddCartItemInput,
  type CreateOrderInput,
  type LoginInput,
  type NetworkId,
  type NftListParams,
  type PasswordChangeInput,
  type ProfileUpdateInput,
  type RegisterInput,
  type WalletConnectInput,
  type WalletInput,
} from '@/shared/contracts'
import { request, requestVoid } from './http'

type Signal = { signal?: AbortSignal }

export const authApi = {
  register: (input: RegisterInput) => request(Session, { method: 'POST', url: '/auth/register', data: input }),
  login: (input: LoginInput) => request(Session, { method: 'POST', url: '/auth/login', data: input }),
  session: ({ signal }: Signal = {}) => request(SessionInfo, { method: 'GET', url: '/auth/session', signal }),
  logout: () => requestVoid({ method: 'POST', url: '/auth/logout' }),
}

export function toListQuery(params: NftListParams) {
  return {
    q: params.q || undefined,
    collections: params.collections?.length ? params.collections.join(',') : undefined,
    networks: params.networks?.length ? params.networks.join(',') : undefined,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    tab: params.tab && params.tab !== 'todos' ? params.tab : undefined,
    sort: params.sort && params.sort !== 'recentes' ? params.sort : undefined,
    page: params.page && params.page > 1 ? params.page : undefined,
    pageSize: params.pageSize,
    exclude: params.exclude,
  }
}

export const nftApi = {
  list: (params: NftListParams, { signal }: Signal = {}) =>
    request(NftListResponse, { method: 'GET', url: '/nfts', params: toListQuery(params), signal }),
  detail: (id: string, { signal }: Signal = {}) => request(NftDetail, { method: 'GET', url: `/nfts/${encodeURIComponent(id)}`, signal }),
}

export const favoritesApi = {
  list: ({ signal }: Signal = {}) => request(FavoritesResponse, { method: 'GET', url: '/favorites', signal }),
  add: (nftId: string) => request(FavoritesResponse, { method: 'PUT', url: `/favorites/${encodeURIComponent(nftId)}` }),
  remove: (nftId: string) => request(FavoritesResponse, { method: 'DELETE', url: `/favorites/${encodeURIComponent(nftId)}` }),
}

export const cartApi = {
  get: ({ signal }: Signal = {}) => request(Cart, { method: 'GET', url: '/cart', signal }),
  addItem: (input: AddCartItemInput) => request(Cart, { method: 'POST', url: '/cart/items', data: input }),
  updateItem: (itemId: string, quantity: number) => request(Cart, { method: 'PATCH', url: `/cart/items/${itemId}`, data: { quantity } }),
  removeItem: (itemId: string) => request(Cart, { method: 'DELETE', url: `/cart/items/${itemId}` }),
  applyCoupon: (code: string) => request(Cart, { method: 'POST', url: '/cart/coupon', data: { code } }),
  removeCoupon: () => request(Cart, { method: 'DELETE', url: '/cart/coupon' }),
  merge: (guestCartId: string) => request(Cart, { method: 'POST', url: '/cart/merge', data: { guestCartId } }),
  quote: (network: NetworkId, context: 'cart' | 'checkout', { signal }: Signal = {}) =>
    request(Quote, { method: 'GET', url: '/cart/quote', params: { network, context }, signal }),
}

/** Timeout menor para criação de pedido: a recuperação usa a mesma chave de idempotência. */
export const ORDER_REQUEST_TIMEOUT_MS = 8_000

export const ordersApi = {
  create: (input: CreateOrderInput, idempotencyKey: string) =>
    request(Order, {
      method: 'POST',
      url: '/orders',
      data: input,
      timeout: ORDER_REQUEST_TIMEOUT_MS,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  get: (orderId: string, { signal }: Signal = {}) => request(Order, { method: 'GET', url: `/orders/${encodeURIComponent(orderId)}`, signal }),
  list: (filters: { status?: Order['status']; idempotencyKey?: string }, { signal }: Signal = {}) =>
    request(OrdersResponse, { method: 'GET', url: '/orders', params: filters, signal }),
}

export const profileApi = {
  get: ({ signal }: Signal = {}) => request(Profile, { method: 'GET', url: '/profile', signal }),
  update: (input: ProfileUpdateInput) => request(Profile, { method: 'PATCH', url: '/profile', data: input }),
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('avatar', file)
    return request(Profile, { method: 'PUT', url: '/profile/avatar', data: form })
  },
  removeAvatar: () => request(Profile, { method: 'DELETE', url: '/profile/avatar' }),
  changePassword: (input: PasswordChangeInput) => requestVoid({ method: 'POST', url: '/profile/password', data: input }),
}

export const walletsApi = {
  list: ({ signal }: Signal = {}) => request(WalletsResponse, { method: 'GET', url: '/wallets', signal }),
  create: (input: WalletInput) => request(Wallet, { method: 'POST', url: '/wallets', data: input }),
  update: (walletId: string, input: WalletInput) => request(Wallet, { method: 'PATCH', url: `/wallets/${walletId}`, data: input }),
  connect: (input: WalletConnectInput) => request(WalletConnection, { method: 'POST', url: '/wallet-connections', data: input }),
  disconnect: (connectionId: string) => requestVoid({ method: 'DELETE', url: `/wallet-connections/${connectionId}` }),
}
