import { createFileRoute } from '@tanstack/react-router'
import { WalletsPage } from '@/features/account/wallets-page'

export const Route = createFileRoute('/_auth/perfil/carteiras')({
  head: () => ({ meta: [{ title: 'Carteiras — Kurio' }, { name: 'robots', content: 'noindex' }] }),
  component: WalletsPage,
})
