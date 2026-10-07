import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { nftApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import type { NftListParams } from '@/shared/contracts'
import { realtimeClient } from '@/features/realtime/realtime-client'

export const nftListQuery = (params: NftListParams) =>
  queryOptions({
    queryKey: queryKeys.nfts.list(params),
    // O AbortSignal cancela a requisição quando os parâmetros mudam (respostas obsoletas são descartadas).
    queryFn: async ({ signal }) => {
      const data = await nftApi.list(params, { signal })
      for (const item of data.items) realtimeClient.observeVersion(`nft:${item.id}`, item.version)
      return data
    },
  })

export const nftDetailQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.nfts.detail(id),
    queryFn: async ({ signal }) => {
      const data = await nftApi.detail(id, { signal })
      realtimeClient.observeVersion(`nft:${data.id}`, data.version)
      return data
    },
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  })

export function useNftList(params: NftListParams) {
  return useQuery({ ...nftListQuery(params), placeholderData: keepPreviousData })
}

export function useNftDetail(id: string) {
  return useQuery(nftDetailQuery(id))
}
