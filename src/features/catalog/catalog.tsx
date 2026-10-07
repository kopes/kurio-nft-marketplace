import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FilterIcon, SearchMobileIcon } from '@/components/icons'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { NftImage } from '@/components/nft/nft-image'
import { Pagination } from '@/components/common/pagination'
import { BackgroundRefresh, EmptyState, ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { catalogSorts, catalogTabs, collectionLabels, networkLabels, type CatalogSort, type NftSummary } from '@/shared/contracts'
import { useIsMobile } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { useAddToCart } from '@/features/cart/queries'
import { useFavorites, useToggleFavorite } from '@/features/favorites/queries'
import { useRealtimeTopic } from '@/features/realtime/realtime-bridge'
import { CatalogFilters } from './catalog-filters'
import { nftDetailQuery, useNftList } from './queries'
import { hasActiveFilters, joinList, selectedCollections, selectedNetworks, sortLabels, tabLabels, toListParams, type CatalogSearch } from './search'

export type SearchUpdater = (patch: Partial<CatalogSearch>, options?: { replace?: boolean; resetPage?: boolean }) => void

interface CatalogProps {
  search: CatalogSearch
  onSearchChange: SearchUpdater
  /** Exibe o campo de busca no topo (página Mercado). */
  showSearch?: boolean
  /** No mobile, a barra de busca/filtros é renderizada fora do catálogo (acima do hero na home). */
  externalMobileToolbar?: boolean
  headingId: string
}

const clearedFilters = { q: undefined, colecoes: undefined, redes: undefined, precoMin: undefined, precoMax: undefined, aba: undefined } as const

function useDebouncedSearch(value: string | undefined, onCommit: (value: string | undefined) => void) {
  const [draft, setDraft] = useState(value ?? '')
  const [previous, setPrevious] = useState(value)
  const commit = useEffectEvent(onCommit)

  // Busca alterada fora do campo (histórico, chips, limpar filtros): sincroniza o rascunho.
  if (value !== previous) {
    setPrevious(value)
    if ((draft.trim() || undefined) !== value) setDraft(value ?? '')
  }

  useEffect(() => {
    const normalized = draft.trim() || undefined
    if (normalized === (value || undefined)) return
    const timer = setTimeout(() => commit(normalized), 350)
    return () => clearTimeout(timer)
  }, [draft, value])

  return [draft, setDraft] as const
}

/** Campo "Explorar coleções" (nó "Search Bar" do frame mobile: 45 px, raio 10, ícone e texto #B39463). */
function SearchField({ value, onCommit, className, id }: { value: string | undefined; onCommit: (value: string | undefined) => void; className?: string; id: string }) {
  const [draft, setDraft] = useDebouncedSearch(value, onCommit)
  return (
    <form
      role="search"
      className={cn('group/search relative', className)}
      onSubmit={(event) => {
        event.preventDefault()
        onCommit(draft.trim() || undefined)
      }}
    >
      <label htmlFor={id} className="sr-only">
        Buscar NFTs no catálogo
      </label>
      <SearchMobileIcon className="pointer-events-none absolute top-1/2 left-3 size-[22px] -translate-y-1/2 text-khaki transition-colors duration-300 group-focus-within/search:text-highlight" />
      <input
        id={id}
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Explorar coleções"
        maxLength={80}
        className="h-[45px] w-full rounded-[10px] border border-transparent bg-card pr-3 pl-[42px] transition-[border-color,background-color,box-shadow] duration-300 hover:bg-raised/70 focus-visible:shadow-[0_0_0_5px_rgb(232_155_85/0.12)] text-sm leading-4 font-bold text-foreground placeholder:font-bold placeholder:text-khaki focus-visible:border-highlight focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ring/70 [&::-webkit-search-cancel-button]:invert"
      />
    </form>
  )
}

/** Busca + filtros (drawer). No drawer também ficam a ordenação e o total de resultados no mobile. */
export function CatalogToolbar({ search, onSearchChange, headingId, className }: { search: CatalogSearch; onSearchChange: SearchUpdater; headingId: string; className?: string }) {
  const list = useNftList(toListParams(search))
  const [open, setOpen] = useState(false)
  const update: SearchUpdater = (patch, options) => onSearchChange(patch, { resetPage: true, ...options })
  const data = list.data
  const active = (search.q ? 1 : 0) + selectedCollections(search).length + selectedNetworks(search).length + (search.precoMin || search.precoMax ? 1 : 0)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <SearchField id={`${headingId}-search-mobile`} value={search.q} onCommit={(q) => update({ q }, { replace: true })} className="min-w-0 flex-1" />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="relative flex size-[45px] shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,rgb(210_138_76/0.45)_-10%,#d28a4c_100%)] text-ink transition-[opacity,scale] duration-300 ease-spring hover:opacity-90 motion-safe:active:scale-90"
            aria-label={`Filtros${active ? ` (${active} ativos)` : ''}`}
          >
            <FilterIcon className="size-[22px]" />
            {active > 0 && (
              <span key={active} aria-hidden="true" className="absolute -top-1 -right-1 flex size-5 animate-pop items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-ink">
                {active}
              </span>
            )}
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl border-0 p-0">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="text-lg font-bold">Filtros</SheetTitle>
            <SheetDescription className="text-sand">{data ? `${data.total} ${data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}` : 'Carregando resultados…'}</SheetDescription>
          </SheetHeader>
          <fieldset className="flex flex-col gap-3 px-5 pt-2">
            <legend className="mb-3 text-lg leading-4 font-bold">Ordenar por</legend>
            <div role="radiogroup" aria-label="Ordenar por" className="flex flex-wrap gap-2">
              {catalogSorts.map((sort) => {
                const checked = (search.ordem ?? 'recentes') === sort
                return (
                  <button
                    key={sort}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => update({ ordem: sort === 'recentes' ? undefined : sort })}
                    className={cn('rounded-full border px-3 py-1.5 text-sm transition-colors', checked ? 'border-primary text-highlight' : 'border-line text-sand hover:border-primary/60')}
                  >
                    {sortLabels[sort]}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <CatalogFilters search={search} facets={data?.facets} onChange={(patch) => update(patch)} className="bg-transparent" />
          <div className="sticky bottom-0 flex gap-3 bg-card p-4">
            <Button variant="outline" className="flex-1" onClick={() => update({ colecoes: undefined, redes: undefined, precoMin: undefined, precoMax: undefined })}>
              Limpar filtros
            </Button>
            <Button className="flex-1" onClick={() => setOpen(false)}>
              Ver resultados
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function FeaturedBanner() {
  return (
    <aside aria-labelledby="featured-title" className="relative overflow-hidden bg-gradient-to-b from-primary/10 to-primary/[0.03] pt-6">
      <h2 id="featured-title" className="px-5 text-2xl leading-8 font-bold text-highlight">
        NFT EM DESTAQUE
      </h2>
      <p className="mt-4 px-5 text-center text-[22px] leading-4 font-bold">OFERTA LIMITADA</p>
      <Link to="/nft/$nftId" params={{ nftId: 'sage-nomad-009' }} className="mt-4 block overflow-hidden rounded-[22px]" aria-label="Ver Sage Nomad #009, NFT em destaque">
        <NftImage artwork="sage" alt="" sizes="310px" className="aspect-[310/368] rounded-[22px] transition-transform duration-700 ease-out-expo motion-safe:hover:scale-[1.04]" />
      </Link>
    </aside>
  )
}

export function Catalog({ search, onSearchChange, showSearch = false, externalMobileToolbar = false, headingId }: CatalogProps) {
  const params = toListParams(search)
  const list = useNftList(params)
  const favorites = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const addToCart = useAddToCart()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const gridRef = useRef<HTMLDivElement>(null)

  // Assina atualizações em tempo real dos NFTs visíveis (liberadas ao sair da página).
  useRealtimeTopic('nft:*')

  const update: SearchUpdater = (patch, options) => onSearchChange(patch, { resetPage: true, ...options })

  const quickAdd = async (nft: NftSummary) => {
    try {
      const detail = await queryClient.fetchQuery(nftDetailQuery(nft.id))
      const edition = [...detail.editions].filter((item) => item.status === 'available').sort((a, b) => b.available - a.available)[0]
      if (!edition) {
        toast.error(`${nft.name} não tem edições disponíveis.`)
        return
      }
      addToCart.mutate({ nftId: nft.id, editionId: edition.id, quantity: 1, name: nft.name })
    } catch {
      toast.error('Não foi possível adicionar ao carrinho. Tente novamente.')
    }
  }

  const changePage = (page: number) => {
    onSearchChange({ pagina: page > 1 ? page : undefined }, { resetPage: false })
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const collections = selectedCollections(search)
  const networks = selectedNetworks(search)
  const chips = [
    ...(search.q ? [{ key: 'q', label: `Busca: “${search.q}”`, clear: () => update({ q: undefined }) }] : []),
    ...collections.map((id) => ({
      key: `c-${id}`,
      label: collectionLabels[id],
      clear: () => update({ colecoes: joinList(collections.filter((item) => item !== id)) }),
    })),
    ...networks.map((id) => ({ key: `n-${id}`, label: networkLabels[id], clear: () => update({ redes: joinList(networks.filter((item) => item !== id)) }) })),
    ...(search.precoMin || search.precoMax
      ? [{ key: 'price', label: `Preço: ${search.precoMin ?? 'mín.'} – ${search.precoMax ?? 'máx.'} ETH`, clear: () => update({ precoMin: undefined, precoMax: undefined }) }]
      : []),
  ]

  const data = list.data
  const showSkeleton = list.isPending
  const refreshing = list.isFetching && !list.isPending
  const resultText = data ? `${data.total} ${data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}` : 'Carregando NFTs…'

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-12">
      <div className="hidden w-[310px] shrink-0 flex-col gap-6 lg:flex">
        <CatalogFilters search={search} facets={data?.facets} onChange={(patch) => update(patch)} />
        <FeaturedBanner />
      </div>

      <div ref={gridRef} className="flex min-w-0 flex-1 scroll-mt-6 flex-col gap-4 md:gap-8">
        {!(externalMobileToolbar && isMobile) && <CatalogToolbar search={search} onSearchChange={onSearchChange} headingId={headingId} className="lg:hidden" />}

        {showSearch && <SearchField id={`${headingId}-search`} value={search.q} onCommit={(q) => update({ q }, { replace: true })} className="hidden max-w-md lg:block" />}

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          {/* Abas: no mobile "Todos os NFTs" fica a 4 px de "Novos lançamentos" e este a 16 px de "Em alta" (nó "Tabs"). */}
          <div role="group" aria-label="Destaques do catálogo" className="flex overflow-x-auto md:gap-5">
            {catalogTabs.map((tab, index) => {
              const active = (search.aba ?? 'todos') === tab
              return (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ aba: tab === 'todos' ? undefined : tab })}
                  className={cn(
                    'shrink-0 border-b-2 pb-1 text-sm leading-4 whitespace-nowrap transition-colors md:text-[15px] md:font-medium',
                    index === 0 && 'max-md:mr-1',
                    index === 1 && 'max-md:mr-4',
                    active ? 'border-primary font-bold text-highlight' : 'border-transparent font-normal text-foreground hover:text-highlight',
                  )}
                >
                  {tabLabels[tab]}
                </button>
              )
            })}
          </div>
          {/* O frame mobile não tem ordenação na tela: no mobile ela fica no drawer de filtros. */}
          <div className="flex items-center gap-2 max-md:hidden">
            <span id={`${headingId}-sort`} className="text-[15px] whitespace-nowrap">
              Ordenar por:
            </span>
            <Select value={search.ordem ?? 'recentes'} onValueChange={(value) => update({ ordem: value === 'recentes' ? undefined : (value as CatalogSort) })}>
              <SelectTrigger aria-labelledby={`${headingId}-sort`} className="h-auto border-0 p-0 text-[15px] hover:text-highlight">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="border-line bg-card">
                {catalogSorts.map((sort) => (
                  <SelectItem key={sort} value={sort}>
                    {sortLabels[sort]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Total e filtros ativos: visíveis a partir do tablet; no mobile (sem esses elementos no Figma) o total é apenas anunciado. */}
        <div className="flex min-h-6 flex-wrap items-center gap-2 max-md:contents">
          <p className="text-sm text-sand max-md:sr-only" role="status" aria-live="polite">
            {resultText}
          </p>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="animate-scale-in rounded-full border border-primary/60 px-3 py-1 text-xs text-highlight transition-colors hover:bg-primary/10 max-md:hidden"
              aria-label={`Remover filtro ${chip.label}`}
            >
              {chip.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          {hasActiveFilters(search) && (
            <button
              type="button"
              className="text-xs text-khaki underline-offset-4 hover:text-highlight hover:underline max-md:hidden"
              onClick={() => update(clearedFilters)}
            >
              Limpar tudo
            </button>
          )}
          <span className="max-md:hidden">
            <BackgroundRefresh active={refreshing} />
          </span>
        </div>

        {list.isError && !data ? (
          <ErrorState error={list.error} title="Não foi possível carregar o catálogo" onRetry={() => void list.refetch()} retrying={list.isFetching} />
        ) : (
          <>
            {list.isError && data && (
              <ErrorState error={list.error} title="Mostrando resultados anteriores" onRetry={() => void list.refetch()} retrying={list.isFetching} className="py-6" />
            )}
            {data && data.items.length === 0 ? (
              <EmptyState
                title="Nenhum NFT encontrado"
                description="Ajuste a busca ou os filtros para ver mais resultados."
                action={
                  hasActiveFilters(search) ? (
                    <Button variant="outline" onClick={() => update(clearedFilters)}>
                      Limpar filtros
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              /*
               * Mobile: colunas desencontradas ("escadinha") como no nó "Product Grid": a coluna direita
               * começa 32 px abaixo. O deslocamento é visual (translate) para manter a ordem de leitura.
               */
              <ul
                aria-labelledby={headingId}
                aria-busy={showSkeleton || refreshing}
                className={cn(
                  'grid grid-cols-2 gap-x-4 gap-y-6 max-md:pb-8 sm:gap-x-6 md:gap-y-8 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-[72px]',
                  refreshing && 'opacity-80 transition-opacity',
                )}
              >
                {showSkeleton
                  ? Array.from({ length: 9 }, (_, index) => (
                      <li key={index} className="max-md:even:translate-y-8">
                        <NftCardSkeleton />
                      </li>
                    ))
                  : data!.items.map((nft, index) => (
                      <li key={nft.id} className="max-md:even:translate-y-8">
                        {/* Entrada em cascata (até ~0,4 s): cards que continuam na grade após um filtro não repetem a animação. */}
                        <NftCard
                          nft={nft}
                          priority={index < 3}
                          className="animate-fade-up"
                          style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
                          column={index % 2 === 0 ? 'left' : 'right'}
                          favorite={favorites.data?.has(nft.id)}
                          onToggleFavorite={(item) => toggleFavorite.toggle(item.id, !favorites.data?.has(item.id), item.name)}
                          onQuickAdd={(item) => void quickAdd(item)}
                        />
                      </li>
                    ))}
              </ul>
            )}
          </>
        )}

        {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={changePage} className="mt-4" />}
      </div>
    </div>
  )
}
