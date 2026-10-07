import { Link, useRouterState } from '@tanstack/react-router'
import { useSyncExternalStore } from 'react'
import { HeartSolidIcon, HomeIcon, ScanIcon, ShopIcon, UserSolidIcon } from '@/components/icons'
import { useCart } from '@/features/cart/queries'
import { useSession } from '@/features/session/use-session'
import { cn } from '@/lib/utils'

/** Frames mobile que não exibem a barra inferior no Figma (possuem ações próprias no rodapé ou voltar). */
const HIDDEN_ON = /^\/(nft\/|carrinho|pagamento|entrar|cadastro)/

/** Altura da barra (95 px) + o botão central que sobressai 31 px, como no frame "Mobile / Início". */
const BAR_HEIGHT = 95
const BUTTON_OVERHANG = 31

function subscribeWidth(callback: () => void) {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

/**
 * Contorno da barra com o recorte central, recalculado para a largura atual:
 * cantos de 28.93 px e recorte de 151.7 px centralizado (coordenadas do vetor 15:5504 do Figma).
 */
export function tabBarPath(width: number) {
  const c = width / 2
  const x = (offset: number) => (c + offset).toFixed(2)
  return [
    `M${x(75.85)} 0`,
    `C${x(62.09)} 0 ${x(49.87)} 8.2 ${x(44.02)} 20.65`,
    `C${x(36.26)} 37.17 ${x(19.46)} 48.62 ${x(0)} 48.62`,
    `C${x(-19.46)} 48.62 ${x(-36.26)} 37.18 ${x(-44.02)} 20.65`,
    `C${x(-49.87)} 8.2 ${x(-62.1)} 0 ${x(-75.85)} 0`,
    'H28.93C12.95 0 0 12.95 0 28.93',
    `V${BAR_HEIGHT}H${width}V28.93`,
    `C${width} 12.95 ${width - 12.95} 0 ${width - 28.93} 0`,
    'Z',
  ].join('')
}

export function MobileNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const session = useSession()
  const cart = useCart()
  const width = useSyncExternalStore(subscribeWidth, () => window.innerWidth, () => 390)
  const count = cart.data?.totalQuantity ?? 0

  if (HIDDEN_ON.test(pathname)) return null

  // Toque com resposta tátil: o ícone encolhe e volta com mola. O ícone que fica ativo "salta" (a chave muda com o estado).
  const iconLink = (active: boolean) =>
    cn(
      'pointer-events-auto absolute flex size-11 items-center justify-center transition-[color,scale] duration-300 ease-spring motion-safe:active:scale-85',
      active ? 'text-highlight' : 'text-sand hover:text-highlight',
    )
  const iconTop = BUTTON_OVERHANG + 40 - 12
  const homeActive = pathname === '/'
  const favoritesActive = pathname === '/perfil/favoritos'
  const profileActive = pathname.startsWith('/perfil') && !favoritesActive

  return (
    <nav
      aria-label="Navegação inferior"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 [view-transition-name:mobile-nav] md:hidden"
      style={{ height: BAR_HEIGHT + BUTTON_OVERHANG }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 w-full drop-shadow-[0_-10px_15px_rgba(10,6,4,0.45)]"
        height={BAR_HEIGHT}
        viewBox={`0 0 ${width} ${BAR_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <path d={tabBarPath(width)} className="fill-card" />
      </svg>

      <Link to="/" aria-label="Início" aria-current={homeActive ? 'page' : undefined} className={iconLink(homeActive)} style={{ left: 24, top: iconTop }}>
        <span key={String(homeActive)} className={cn('flex', homeActive && 'animate-pop')}>
          <HomeIcon className="size-5" />
        </span>
      </Link>
      <Link
        to="/perfil/favoritos"
        aria-label="Lista de interesse"
        aria-current={favoritesActive ? 'page' : undefined}
        className={iconLink(favoritesActive)}
        style={{ left: 96, top: iconTop + 1 }}
      >
        <span key={String(favoritesActive)} className={cn('flex', favoritesActive && 'animate-pop')}>
          <HeartSolidIcon className="h-[18px] w-5" />
        </span>
      </Link>

      <Link
        to="/mercado"
        aria-label="Explorar mercado"
        aria-current={pathname === '/mercado' ? 'page' : undefined}
        className="pointer-events-auto absolute top-0 left-1/2 flex size-[65px] -translate-x-1/2 items-center justify-center rounded-full bg-[linear-gradient(180deg,rgb(210_138_76/0.4)_-17%,#d28a4c_109%)] text-cream transition-[scale,box-shadow] duration-300 ease-spring hover:shadow-[0_8px_24px_-6px_rgb(232_155_85/0.6)] motion-safe:active:scale-90"
      >
        <ScanIcon className="h-6 w-[27px]" />
      </Link>

      <Link
        to="/carrinho"
        aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
        className={iconLink(false)}
        style={{ right: 90, top: iconTop }}
      >
        <ShopIcon className="size-5" />
        {count > 0 && (
          <span key={count} aria-hidden="true" className="absolute top-1.5 right-1 min-w-4 animate-pop rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-medium text-ink">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Link>
      <Link
        to={session ? '/perfil' : '/entrar'}
        aria-label={session ? 'Meu perfil' : 'Entrar'}
        aria-current={profileActive ? 'page' : undefined}
        className={iconLink(profileActive)}
        style={{ right: 28, top: iconTop }}
      >
        <span key={String(profileActive)} className={cn('flex', profileActive && 'animate-pop')}>
          <UserSolidIcon className="size-5" />
        </span>
      </Link>
    </nav>
  )
}
