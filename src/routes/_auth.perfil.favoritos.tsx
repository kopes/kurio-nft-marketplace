import { createFileRoute } from '@tanstack/react-router'
import { FavoritesPage } from '@/features/account/favorites-page'

export const Route = createFileRoute('/_auth/perfil/favoritos')({
  head: () => ({ meta: [{ title: 'Lista de interesse — Kurio' }, { name: 'robots', content: 'noindex' }] }),
  component: FavoritesPage,
})
