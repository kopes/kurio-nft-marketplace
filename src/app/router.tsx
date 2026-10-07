import type { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { RouteError } from '@/components/common/route-error'
import { NotFound } from '@/components/common/not-found'
import { PagePending } from '@/components/common/states'

export interface RouterContext {
  queryClient: QueryClient
}

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    // Dados ficam no TanStack Query; o router apenas dispara o prefetch.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    // A transição de página já suaviza a troca; a rolagem volta ao topo na hora, sem percorrer a página antiga.
    scrollRestorationBehavior: 'instant',
    /*
     * Transição suave só ao trocar de página: não no carregamento inicial (não interfere no LCP), não em mudanças
     * apenas de busca/filtros (o catálogo atualiza no lugar) e nunca com movimento reduzido.
     */
    defaultViewTransition: {
      types: ({ fromLocation, pathChanged }) => {
        if (!fromLocation || !pathChanged) return false
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
        return ['page']
      },
    },
    defaultErrorComponent: RouteError,
    // Rotas são divididas em chunks: se o código da página demorar, mostra o anel de carregamento (sem piscar).
    defaultPendingComponent: PagePending,
    defaultPendingMs: 200,
    defaultPendingMinMs: 300,
    defaultNotFoundComponent: () => <NotFound />,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
