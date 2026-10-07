import { z } from 'zod'
import {
  CatalogSort,
  CatalogTab,
  collectionIds,
  networkIds,
  type CollectionId,
  type NetworkId,
  type NftListParams,
} from '@/shared/contracts'

const priceParam = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .pipe(z.string().regex(/^\d+(\.\d{1,4})?$/))
  .optional()
  .catch(undefined)

/**
 * Estado do catálogo na URL (sobrevive a refresh e ao histórico).
 * Valores inválidos são descartados (`catch`) em vez de quebrar a página.
 * Listas usam vírgula para manter URLs legíveis: `?colecoes=arte-digital,musica`.
 */
export const catalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  colecoes: z.string().max(200).optional().catch(undefined),
  redes: z.string().max(60).optional().catch(undefined),
  precoMin: priceParam,
  precoMax: priceParam,
  aba: CatalogTab.optional().catch(undefined),
  ordem: CatalogSort.optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).max(999).optional().catch(undefined),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export const PAGE_SIZE = 9

function parseList<T extends string>(value: string | undefined, allowed: readonly T[]): T[] {
  if (!value) return []
  return [...new Set(value.split(','))].filter((item): item is T => (allowed as readonly string[]).includes(item))
}

export function selectedCollections(search: CatalogSearch): CollectionId[] {
  return parseList(search.colecoes, collectionIds)
}

export function selectedNetworks(search: CatalogSearch): NetworkId[] {
  return parseList(search.redes, networkIds)
}

export function joinList(values: string[]) {
  return values.length ? values.join(',') : undefined
}

export function toListParams(search: CatalogSearch): NftListParams {
  return {
    q: search.q || undefined,
    collections: selectedCollections(search),
    networks: selectedNetworks(search),
    minPrice: search.precoMin,
    maxPrice: search.precoMax,
    tab: search.aba ?? 'todos',
    sort: search.ordem ?? 'recentes',
    page: search.pagina ?? 1,
    pageSize: PAGE_SIZE,
  }
}

export function hasActiveFilters(search: CatalogSearch) {
  return Boolean(search.q || search.colecoes || search.redes || search.precoMin || search.precoMax || (search.aba && search.aba !== 'todos'))
}

export const sortLabels: Record<CatalogSort, string> = {
  recentes: 'Listados recentemente',
  'menor-preco': 'Menor preço',
  'maior-preco': 'Maior preço',
  nome: 'Nome (A–Z)',
}

export const tabLabels: Record<CatalogTab, string> = {
  todos: 'Todos os NFTs',
  novos: 'Novos lançamentos',
  'em-alta': 'Em alta',
}
