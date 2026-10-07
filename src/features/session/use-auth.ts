import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { authApi, cartApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import type { LoginInput, RegisterInput, Session } from '@/shared/contracts'
import { announce } from '@/lib/announcer'
import { guestCartId, rotateGuestCartId, sessionStore } from './session-store'

/**
 * Inicia a sessão e preserva o carrinho do visitante: os itens são mesclados no
 * carrinho do usuário pela API e o identificador de visitante é renovado.
 */
export async function completeSignIn(queryClient: QueryClient, session: Session) {
  const guestId = guestCartId()
  queryClient.removeQueries({ queryKey: queryKeys.private.all })
  sessionStore.start(session)
  try {
    const cart = await cartApi.merge(guestId)
    queryClient.setQueryData(queryKeys.cart.detail(`user:${session.user.id}`), cart)
  } catch {
    toast.warning('Não foi possível trazer os itens do carrinho de visitante. Eles continuam salvos neste dispositivo.')
    return
  }
  queryClient.removeQueries({ queryKey: queryKeys.cart.scope(`guest:${guestId}`) })
  rotateGuestCartId()
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: async (session) => {
      await completeSignIn(queryClient, session)
      announce(`Bem-vindo de volta, ${session.user.displayName}.`)
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: async (session) => {
      await completeSignIn(queryClient, session)
      announce('Conta criada com sucesso.')
    },
  })
}

export function useLogout() {
  const router = useRouter()
  return useMutation({
    mutationFn: async () => {
      await authApi.logout().catch(() => undefined)
    },
    onSettled: async () => {
      // Sai de rotas privadas antes de encerrar a sessão (evita redirecionar ao login).
      if (router.state.matches.some((match) => match.routeId.startsWith('/_auth'))) {
        await router.navigate({ to: '/' })
      }
      sessionStore.end('logout')
      toast.success('Você saiu da sua conta.')
      announce('Você saiu da sua conta.')
    },
  })
}
