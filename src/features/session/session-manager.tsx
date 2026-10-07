/**
 * Ciclo de vida da sessão no cliente:
 *  - valida o token persistido ao carregar (recuperação após refresh);
 *  - trata expiração (401 da API ou prazo vencido) redirecionando ao login com retorno;
 *  - ao encerrar/trocar a sessão, remove do cache todos os dados privados do usuário anterior.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { authApi } from '@/api/endpoints'
import { onSessionExpired } from '@/api/http'
import { queryKeys } from '@/api/query-keys'
import { announce } from '@/lib/announcer'
import { cartNotices } from '@/features/cart/cart-notices'
import { clearCheckoutDraft } from '@/features/checkout/checkout-storage'
import { sessionStore } from './session-store'
import { useSession } from './use-session'

export function SessionManager() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const href = useRouterState({ select: (state) => state.location.href })
  const session = useSession()

  // Limpeza de dados privados ao sair, expirar ou trocar de usuário.
  useEffect(
    () =>
      sessionStore.onEnd((reason, previous) => {
        const userId = previous.user.id
        void queryClient.cancelQueries({ queryKey: queryKeys.private.user(userId) })
        queryClient.removeQueries({ queryKey: queryKeys.private.user(userId) })
        queryClient.removeQueries({ queryKey: queryKeys.cart.scope(`user:${userId}`) })
        queryClient.removeQueries({ queryKey: queryKeys.session(previous.token) })
        cartNotices.clear()
        if (reason !== 'expired') clearCheckoutDraft(userId)
      }),
    [queryClient],
  )

  // Expiração sinalizada pela API: preserva a rota atual para retomada após novo login.
  useEffect(
    () =>
      onSessionExpired(() => {
        sessionStore.end('expired')
        toast.error('Sua sessão expirou. Entre novamente para continuar de onde parou.', { id: 'session-expired' })
        announce('Sua sessão expirou. Entre novamente para continuar.', 'assertive')
        const current = window.location.pathname + window.location.search
        void navigate({ to: '/entrar', search: { redirect: current, motivo: 'expirada' }, replace: true })
      }),
    [navigate],
  )

  // Valida o token persistido e atualiza dados do usuário.
  const validation = useQuery({
    queryKey: queryKeys.session(session?.token ?? 'anonymous'),
    queryFn: ({ signal }) => authApi.session({ signal }),
    enabled: Boolean(session),
    staleTime: 60_000,
    retry: 1,
  })

  useEffect(() => {
    if (validation.data && session) {
      sessionStore.start({ ...session, expiresAt: validation.data.expiresAt, user: validation.data.user })
    }
    // `session` é intencionalmente omitido: atualizar a sessão não deve revalidar em laço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validation.data])

  // Expiração por prazo durante a navegação, mesmo sem requisições.
  useEffect(() => {
    if (!session) return
    const remaining = Date.parse(session.expiresAt) - Date.now()
    const timer = setTimeout(
      () => {
        // Confirma com a API: o 401 aciona o fluxo de expiração acima.
        void queryClient.invalidateQueries({ queryKey: queryKeys.session(session.token) })
      },
      Math.max(0, Math.min(remaining + 500, 2 ** 31 - 1)),
    )
    return () => clearTimeout(timer)
  }, [session, queryClient, href])

  return null
}
