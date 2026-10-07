import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { Catalog, CatalogToolbar, type SearchUpdater } from '@/features/catalog/catalog'
import { nftListQuery } from '@/features/catalog/queries'
import { catalogSearchSchema, toListParams } from '@/features/catalog/search'
import { Hero, Journal, Promos } from '@/features/home/home-sections'
import { useIsMobile } from '@/hooks/use-media-query'

export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  search: { middlewares: [stripSearchParams({ pagina: 1, aba: 'todos', ordem: 'recentes' })] },
  loaderDeps: ({ search }) => toListParams(search),
  // Prefetch não bloqueante: a página renderiza imediatamente com skeletons.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftListQuery(deps))
  },
  head: () => ({ meta: [{ title: 'Kurio — Seja dono do futuro da arte digital' }] }),
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const isMobile = useIsMobile()
  const onSearchChange: SearchUpdater = (patch, options) =>
    void navigate({
      search: (prev) => ({ ...prev, ...patch, ...(options?.resetPage ? { pagina: undefined } : {}) }),
      replace: options?.replace,
      resetScroll: false,
    })

  return (
    <>
      {/* Mobile: a busca vem antes do hero (frame "Mobile / Início"). */}
      {isMobile && <CatalogToolbar search={search} onSearchChange={onSearchChange} headingId="catalog-title" className="container-page pt-4 max-md:px-6" />}
      <Hero />
      <section id="catalogo" aria-labelledby="catalog-title" className="container-page mt-4 scroll-mt-4 max-md:px-6 md:mt-24">
        <h2 id="catalog-title" className="sr-only">
          Catálogo de NFTs
        </h2>
        <Catalog search={search} onSearchChange={onSearchChange} externalMobileToolbar headingId="catalog-title" />
      </section>
      <Promos />
      <Journal />
    </>
  )
}
