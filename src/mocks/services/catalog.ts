import type { CatalogSort, CatalogTab, CollectionId, NetworkId, NftDetail, NftListResponse, NftSummary } from '@/shared/contracts'
import { collectionIds, collectionLabels, networkIds, networkLabels } from '@/shared/contracts'
import { compareEth, maxEth, minEth } from '@/shared/eth'
import { db } from '../db'
import type { NftRecord } from '../fixtures/nfts'
import { ApiFailure } from '../lib/http'

export const TRENDING_THRESHOLD = 300

export function availableUnits(record: NftRecord) {
  return record.editions.filter((edition) => edition.status === 'available').reduce((total, edition) => total + edition.available, 0)
}

export function toSummary(record: NftRecord): NftSummary {
  return {
    id: record.id,
    name: record.name,
    tokenId: record.tokenId,
    artwork: record.artwork,
    collection: record.collection,
    collectionName: record.collectionName,
    network: record.network,
    price: record.price,
    compareAtPrice: record.compareAtPrice,
    rarity: record.rarity,
    isNewRelease: record.isNewRelease,
    available: availableUnits(record),
    listedAt: record.listedAt,
    version: record.version,
  }
}

export function toDetail(record: NftRecord): NftDetail {
  return {
    ...toSummary(record),
    description: record.description,
    story: record.story,
    attributes: record.attributes,
    rating: record.rating,
    reviewsCount: record.reviewsCount,
    editions: record.editions.map((edition) => ({ ...edition })),
    contractAddress: record.contractAddress,
    royaltyPercent: record.royaltyPercent,
    creator: record.creator,
    gallery: record.gallery,
    reviews: record.reviews,
  }
}

export function findNft(id: string) {
  const record = db().nfts.find((item) => item.id === id)
  if (!record) throw new ApiFailure(404, 'NOT_FOUND', 'NFT não encontrado.')
  return record
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export interface ListQuery {
  q: string
  collections: CollectionId[]
  networks: NetworkId[]
  minPrice: string | null
  maxPrice: string | null
  tab: CatalogTab
  sort: CatalogSort
  page: number
  pageSize: number
  exclude: string | null
}

export function parseListQuery(url: URL): ListQuery {
  const list = <T extends string>(key: string, allowed: readonly T[]) =>
    (url.searchParams.get(key) ?? '')
      .split(',')
      .filter((value): value is T => (allowed as readonly string[]).includes(value))
  const price = (key: string) => {
    const value = url.searchParams.get(key)
    return value && /^\d+(\.\d+)?$/.test(value) ? value : null
  }
  const tab = url.searchParams.get('tab')
  const sort = url.searchParams.get('sort')
  return {
    q: (url.searchParams.get('q') ?? '').trim().slice(0, 80),
    collections: list('collections', collectionIds),
    networks: list('networks', networkIds),
    minPrice: price('minPrice'),
    maxPrice: price('maxPrice'),
    tab: tab === 'novos' || tab === 'em-alta' ? tab : 'todos',
    sort: sort === 'menor-preco' || sort === 'maior-preco' || sort === 'nome' ? sort : 'recentes',
    page: Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1),
    pageSize: Math.min(48, Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '9', 10) || 9)),
    exclude: url.searchParams.get('exclude'),
  }
}

type Facet = 'collections' | 'networks' | 'price' | null

function matches(record: NftRecord, query: ListQuery, ignore: Facet) {
  if (query.exclude && record.id === query.exclude) return false
  if (query.q) {
    const haystack = normalize(`${record.name} ${record.tokenId} ${record.collectionName} ${record.creator}`)
    if (!normalize(query.q).split(/\s+/).every((term) => haystack.includes(term))) return false
  }
  if (query.tab === 'novos' && !record.isNewRelease) return false
  if (query.tab === 'em-alta' && record.popularity < TRENDING_THRESHOLD) return false
  if (ignore !== 'collections' && query.collections.length && !query.collections.includes(record.collection)) return false
  if (ignore !== 'networks' && query.networks.length && !query.networks.includes(record.network)) return false
  if (ignore !== 'price') {
    if (query.minPrice && compareEth(record.price, query.minPrice) < 0) return false
    if (query.maxPrice && compareEth(record.price, query.maxPrice) > 0) return false
  }
  return true
}

const sorters: Record<CatalogSort, (a: NftRecord, b: NftRecord) => number> = {
  recentes: (a, b) => b.listedAt.localeCompare(a.listedAt),
  'menor-preco': (a, b) => compareEth(a.price, b.price) || a.name.localeCompare(b.name, 'pt-BR'),
  'maior-preco': (a, b) => compareEth(b.price, a.price) || a.name.localeCompare(b.name, 'pt-BR'),
  nome: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
}

export function listNfts(query: ListQuery, { empty = false } = {}): NftListResponse {
  const all = empty ? [] : db().nfts
  const filtered = all.filter((record) => matches(record, query, null))
  const sorted = [...filtered].sort(query.tab === 'em-alta' && query.sort === 'recentes' ? (a, b) => b.popularity - a.popularity : sorters[query.sort])
  const totalPages = Math.max(1, Math.ceil(sorted.length / query.pageSize))
  const page = Math.min(query.page, totalPages)
  const start = (page - 1) * query.pageSize

  const countBy = <K extends string>(ids: readonly K[], key: 'collection' | 'network', facet: Facet, labels: Record<K, string>) => {
    const scope = all.filter((record) => matches(record, query, facet))
    return ids.map((id) => ({ id, label: labels[id], count: scope.filter((record) => record[key] === id).length }))
  }

  const priceScope = all.filter((record) => matches(record, query, 'price'))
  const priceRange = priceScope.reduce(
    (range, record) => ({ min: minEth(range.min, record.price), max: maxEth(range.max, record.price) }),
    { min: priceScope[0]?.price ?? '0', max: priceScope[0]?.price ?? '0' },
  )

  return {
    items: sorted.slice(start, start + query.pageSize).map(toSummary),
    page,
    pageSize: query.pageSize,
    total: sorted.length,
    totalPages,
    facets: {
      collections: countBy(collectionIds, 'collection', 'collections', collectionLabels),
      networks: countBy(networkIds, 'network', 'networks', networkLabels),
      price: priceRange,
    },
  }
}
