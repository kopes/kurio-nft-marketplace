import { createRootRouteWithContext, HeadContent, Outlet, useRouterState } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useRef } from 'react'
import type { RouterContext } from '@/app/router'
import { LiveRegion } from '@/components/common/live-region'
import { NotFound } from '@/components/common/not-found'
import { MobileNav } from '@/components/layout/mobile-nav'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { Toaster } from '@/components/ui/sonner'
import { RealtimeBridge } from '@/features/realtime/realtime-bridge'
import { SessionManager } from '@/features/session/session-manager'
import { MOCKS_ENABLED } from '@/shared/config'

const ScenarioPanel = lazy(() => import('@/features/dev/scenario-panel'))

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [{ title: 'Kurio — Marketplace de NFTs' }],
  }),
  component: RootLayout,
  notFoundComponent: () => <NotFound />,
})

/** Após navegar, move o foco para o conteúdo principal (anunciado por leitores de tela). */
function useFocusOnNavigate() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  // Compara com o caminho anterior (e não com uma flag de "primeira execução"),
  // para não roubar o foco quando o StrictMode reexecuta o efeito no carregamento.
  const previous = useRef(pathname)
  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    document.getElementById('conteudo')?.focus({ preventScroll: true })
  }, [pathname])
}

function RootLayout() {
  useFocusOnNavigate()
  return (
    <>
      <HeadContent />
      <a href="#conteudo" className="sr-only-focusable fixed top-2 left-2 z-[100] rounded-md bg-primary px-4 py-2 font-bold text-ink">
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <SiteFooter />
      <MobileNav />
      <Toaster position="bottom-right" offset={24} mobileOffset={{ bottom: 88 }} closeButton />
      <LiveRegion />
      <SessionManager />
      <RealtimeBridge />
      {MOCKS_ENABLED && (
        <Suspense fallback={null}>
          <ScenarioPanel />
        </Suspense>
      )}
    </>
  )
}
