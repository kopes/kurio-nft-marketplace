import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AccountLayout } from '@/features/account/account-layout'

export const Route = createFileRoute('/_auth/perfil')({
  component: () => (
    <AccountLayout>
      <Outlet />
    </AccountLayout>
  ),
})
