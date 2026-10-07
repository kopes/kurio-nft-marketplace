import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { Breadcrumbs } from '@/components/common/breadcrumbs'
import { Catalog, type SearchUpdater } from '@/features/catalog/catalog'
import { nftListQuery } from '@/features/catalog/queries'
import { catalogSearchSchema, toListParams } from '@/features/catalog/search'

export const Route = createFileRoute('/mercado')({
  validateSearch: catalogSearchSchema,
  search: { middlewares: [stripSearchParams({ pagina: 1, aba: 'todos', ordem: 'recentes' })] },
  loaderDeps: ({ search }) => toListParams(search),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftListQuery(deps))
  },
  head: () => ({ meta: [{ title: 'Mercado de NFTs — Kurio' }] }),
  component: MarketPage,
})

function MarketPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const onSearchChange: SearchUpdater = (patch, options) =>
    void navigate({
      search: (prev) => ({ ...prev, ...patch, ...(options?.resetPage ? { pagina: undefined } : {}) }),
      replace: options?.replace,
      resetScroll: false,
    })

  return (
    <section aria-labelledby="market-title" className="container-page pt-4 md:pt-8">
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado' }]} />
      <h1 id="market-title" className="mt-4 mb-6 text-2xl font-bold md:text-[28px]">
        Mercado
      </h1>
      <Catalog search={search} onSearchChange={onSearchChange} showSearch headingId="market-title" />
    </section>
  )
}
