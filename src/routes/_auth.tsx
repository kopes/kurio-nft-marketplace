import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { sessionStore } from '@/features/session/session-store'
import { useSession } from '@/features/session/use-session'

/** Layout sem caminho que protege as rotas privadas (checkout, pedidos, perfil, carteiras, favoritos). */
export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ location }) => {
    if (!sessionStore.get()) {
      throw redirect({ to: '/entrar', search: { redirect: location.href } })
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  const session = useSession()
  const navigate = useNavigate()
  const redirected = useRef(false)

  // Expiração é tratada pelo SessionManager (com motivo) e o logout sai da rota antes de encerrar a sessão.
  // Este é apenas um fallback de redirecionamento único (ex.: sessão removida em outra aba).
  useEffect(() => {
    if (session || redirected.current) return
    redirected.current = true
    setTimeout(() => {
      if (!window.location.pathname.startsWith('/entrar')) {
        void navigate({ to: '/entrar', search: { redirect: window.location.pathname + window.location.search }, replace: true })
      }
    }, 0)
  }, [session, navigate])

  return session ? <Outlet /> : null
}
