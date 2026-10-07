import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/features/account/profile-page'

export const Route = createFileRoute('/_auth/perfil/')({
  head: () => ({ meta: [{ title: 'Meu perfil — Kurio' }, { name: 'robots', content: 'noindex' }] }),
  component: ProfilePage,
})
