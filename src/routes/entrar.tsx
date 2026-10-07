import { createFileRoute, redirect } from '@tanstack/react-router'
import { Hero } from '@/features/home/home-sections'
import { AuthDialog } from '@/features/session/auth-dialog'
import { authSearchSchema } from '@/features/session/auth-search'
import { safeRedirect } from '@/lib/redirect'
import { sessionStore } from '@/features/session/session-store'

export const Route = createFileRoute('/entrar')({
  validateSearch: authSearchSchema,
  beforeLoad: ({ search }) => {
    if (sessionStore.get()) throw redirect({ to: safeRedirect(search.redirect), replace: true })
  },
  head: () => ({ meta: [{ title: 'Entrar — Kurio' }] }),
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  return (
    <>
      <div className="hidden md:block" aria-hidden="true" inert>
        <Hero />
      </div>
      <AuthDialog mode="login" redirect={search.redirect} reason={search.motivo} />
    </>
  )
}
