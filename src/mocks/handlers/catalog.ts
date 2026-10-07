import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/shared/config'
import { db, mutate } from '../db'
import { handle, requireAuth } from '../lib/http'
import { currentScenario } from '../scenarios'
import { findNft, listNfts, parseListQuery, toDetail } from '../services/catalog'

export const catalogHandlers = [
  http.get(
    `${API_BASE_URL}/nfts`,
    handle(({ request }) => {
      const query = parseListQuery(new URL(request.url))
      return HttpResponse.json(listNfts(query, { empty: currentScenario().catalogEmpty }))
    }),
  ),

  http.get(
    `${API_BASE_URL}/nfts/:nftId`,
    handle(({ params }) => HttpResponse.json(toDetail(findNft(String(params.nftId))))),
  ),
]

export const favoriteHandlers = [
  http.get(
    `${API_BASE_URL}/favorites`,
    handle(({ request }) => {
      const { user } = requireAuth(request)
      return HttpResponse.json({ items: db().favorites[user.id] ?? [] })
    }),
  ),

  http.put(
    `${API_BASE_URL}/favorites/:nftId`,
    handle(({ request, params }) => {
      const { user } = requireAuth(request)
      const nft = findNft(String(params.nftId))
      const items = mutate((draft) => {
        const current = draft.favorites[user.id] ?? []
        draft.favorites[user.id] = current.includes(nft.id) ? current : [...current, nft.id]
        return draft.favorites[user.id]
      })
      return HttpResponse.json({ items })
    }),
  ),

  http.delete(
    `${API_BASE_URL}/favorites/:nftId`,
    handle(({ request, params }) => {
      const { user } = requireAuth(request)
      const items = mutate((draft) => {
        draft.favorites[user.id] = (draft.favorites[user.id] ?? []).filter((id) => id !== params.nftId)
        return draft.favorites[user.id]
      })
      return HttpResponse.json({ items })
    }),
  ),
]
