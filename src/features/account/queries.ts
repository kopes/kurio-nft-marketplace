import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { profileApi, walletsApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import type { PasswordChangeInput, Profile, ProfileUpdateInput, WalletInput, WalletsResponse } from '@/shared/contracts'
import { announce } from '@/lib/announcer'
import { sessionStore } from '@/features/session/session-store'
import { useSession } from '@/features/session/use-session'

function useUserId() {
  return useSession()?.user.id ?? 'anonymous'
}

export function useProfile() {
  const userId = useUserId()
  return useQuery({
    queryKey: queryKeys.private.profile(userId),
    queryFn: ({ signal }) => profileApi.get({ signal }),
    enabled: userId !== 'anonymous',
  })
}

/** Mantém o usuário da sessão (cabeçalho/menu) coerente com o perfil atualizado. */
function syncSessionUser(profile: Profile) {
  sessionStore.updateUser({
    id: profile.id,
    username: profile.username,
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: (input: ProfileUpdateInput) => profileApi.update(input),
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.private.profile(userId), profile)
      syncSessionUser(profile)
      announce('Perfil atualizado.')
    },
  })
}

export function useAvatarMutations() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  const onSuccess = (profile: Profile) => {
    queryClient.setQueryData(queryKeys.private.profile(userId), profile)
    syncSessionUser(profile)
  }
  return {
    upload: useMutation({ mutationFn: (file: File) => profileApi.uploadAvatar(file), onSuccess }),
    remove: useMutation({ mutationFn: () => profileApi.removeAvatar(), onSuccess }),
  }
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: PasswordChangeInput) => profileApi.changePassword(input),
    onSuccess: () => announce('Senha alterada com sucesso.'),
  })
}

export function useWallets() {
  const userId = useUserId()
  return useQuery({
    queryKey: queryKeys.private.wallets(userId),
    queryFn: ({ signal }) => walletsApi.list({ signal }),
    enabled: userId !== 'anonymous',
  })
}

export function useSaveWallet() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: ({ walletId, input }: { walletId: string | null; input: WalletInput }) => (walletId ? walletsApi.update(walletId, input) : walletsApi.create(input)),
    onSuccess: (wallet) => {
      queryClient.setQueryData<WalletsResponse>(queryKeys.private.wallets(userId), (old) => {
        const items = (old?.items ?? []).filter((item) => item.id !== wallet.id && item.role !== wallet.role)
        return { items: [...items, wallet].sort((a) => (a.role === 'primary' ? -1 : 1)) }
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.private.wallets(userId) })
      announce(wallet.role === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.')
    },
  })
}
