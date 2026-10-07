import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { favoritesApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import type { FavoritesResponse } from '@/shared/contracts'
import { announce } from '@/lib/announcer'
import { useSession } from '@/features/session/use-session'

export function useFavorites() {
  const userId = useSession()?.user.id
  return useQuery({
    queryKey: queryKeys.private.favorites(userId ?? 'anonymous'),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: Boolean(userId),
    select: (data) => new Set(data.items),
  })
}

/**
 * Alterna favorito com atualização otimista: o coração muda na hora, a mutation
 * confirma no servidor e, em caso de falha, o estado anterior é restaurado (rollback).
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const session = useSession()
  const navigate = useNavigate()
  const userId = session?.user.id

  const mutation = useMutation({
    mutationKey: ['favorites', 'toggle'],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      const key = queryKeys.private.favorites(userId!)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FavoritesResponse>(key)
      const items = new Set(previous?.items ?? [])
      if (favorite) items.add(nftId)
      else items.delete(nftId)
      queryClient.setQueryData<FavoritesResponse>(key, { items: [...items] })
      return { previous, key }
    },
    onError: (error, { name }, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
      const message = `Não foi possível atualizar ${name} nos favoritos. ${toApiError(error).message}`
      toast.error(message)
      announce(message, 'assertive')
    },
    onSuccess: (data, { favorite, name }, context) => {
      queryClient.setQueryData(context.key, data)
      const message = favorite ? `${name} adicionado aos favoritos.` : `${name} removido dos favoritos.`
      announce(message)
    },
    onSettled: (_data, _error, _vars, context) => {
      if (context) void queryClient.invalidateQueries({ queryKey: context.key })
    },
  })

  return {
    ...mutation,
    toggle(nftId: string, favorite: boolean, name: string) {
      if (!userId) {
        toast.info('Entre para salvar seus favoritos.')
        void navigate({ to: '/entrar', search: { redirect: window.location.pathname + window.location.search } })
        return
      }
      mutation.mutate({ nftId, favorite, name })
    },
  }
}
