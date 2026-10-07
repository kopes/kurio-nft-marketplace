import type { NetworkId, NftListParams } from '@/shared/contracts'

/**
 * Chaves de cache. Dados privados ficam sob ['private', userId, ...] e o carrinho sob
 * ['cart', escopo], permitindo limpar tudo de uma sessão sem afetar o catálogo público.
 */
export const queryKeys = {
  session: (token: string) => ['session', token] as const,
  nfts: {
    all: ['nfts'] as const,
    lists: ['nfts', 'list'] as const,
    list: (params: NftListParams) => ['nfts', 'list', params] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
  },
  cart: {
    all: ['cart'] as const,
    scope: (scope: string) => ['cart', scope] as const,
    detail: (scope: string) => ['cart', scope, 'detail'] as const,
    quote: (scope: string, network: NetworkId, cartVersion: number, context: 'cart' | 'checkout') =>
      ['cart', scope, 'quote', network, cartVersion, context] as const,
  },
  private: {
    all: ['private'] as const,
    user: (userId: string) => ['private', userId] as const,
    favorites: (userId: string) => ['private', userId, 'favorites'] as const,
    profile: (userId: string) => ['private', userId, 'profile'] as const,
    wallets: (userId: string) => ['private', userId, 'wallets'] as const,
    orders: (userId: string) => ['private', userId, 'orders'] as const,
    order: (userId: string, orderId: string) => ['private', userId, 'orders', orderId] as const,
  },
}
