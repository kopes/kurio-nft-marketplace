import { Link, useRouterState } from '@tanstack/react-router'
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { ActivityIcon, DangerIcon, DownloadIcon, HeartIcon, LocationIcon, LogoutIcon, ShoppingIcon, UserIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { useLogout } from '@/features/session/use-auth'

interface NavItem {
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  to: '/perfil' | '/perfil/carteiras' | '/perfil/favoritos' | '/em-breve'
  secao?: string
}

const items: NavItem[] = [
  { label: 'Dados do perfil', Icon: UserIcon, to: '/perfil' },
  { label: 'Carteiras', Icon: LocationIcon, to: '/perfil/carteiras' },
  { label: 'Atividade', Icon: ShoppingIcon, to: '/em-breve', secao: 'atividade' },
  { label: 'Lista de interesse', Icon: HeartIcon, to: '/perfil/favoritos' },
  { label: 'Ofertas', Icon: ActivityIcon, to: '/em-breve', secao: 'ofertas' },
  { label: 'Arquivos baixados', Icon: DownloadIcon, to: '/em-breve', secao: 'downloads' },
  { label: 'Suporte', Icon: DangerIcon, to: '/em-breve', secao: 'suporte' },
]

export function AccountLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const logout = useLogout()
  return (
    <div className="container-page flex flex-col gap-7 pt-6 md:pt-8 lg:flex-row">
      <nav aria-labelledby="account-nav-title" className="w-full shrink-0 bg-card py-2 lg:w-[310px] lg:self-start">
        <h2 id="account-nav-title" className="px-2.5 py-2.5 text-lg leading-4 font-bold">
          Meu perfil
        </h2>
        <ul className="flex overflow-x-auto lg:flex-col [&::-webkit-scrollbar]:hidden">
          {items.map(({ label, Icon, to, secao }) => {
            const active = !secao && pathname === to
            return (
              <li key={label} className="shrink-0">
                <Link
                  to={to}
                  search={secao ? { secao } : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-[45px] items-center gap-3 border-l-[6px] px-4 text-[15px] whitespace-nowrap text-highlight transition-colors hover:bg-raised max-lg:border-b-[3px] max-lg:border-l-0',
                    active ? 'border-primary' : 'border-transparent',
                  )}
                >
                  <Icon className="size-[18px] text-khaki" />
                  {label}
                  {secao && <span className="rounded-sm bg-raised px-1.5 py-0.5 text-[10px] text-khaki">Em breve</span>}
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="mt-1 border-t border-primary/30">
          <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending} className="flex h-10 w-full items-center gap-2 px-4 text-[15px] font-bold text-highlight hover:bg-raised">
            <LogoutIcon className="size-5" />
            {logout.isPending ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      </nav>
      {/* A chave muda com a página: o conteúdo entra suavemente ao trocar de seção, sem animar o menu lateral. */}
      <div key={pathname} className="min-w-0 flex-1 animate-fade-up pb-10">
        {children}
      </div>
    </div>
  )
}
