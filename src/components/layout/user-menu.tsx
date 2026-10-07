import { Link } from '@tanstack/react-router'
import { HeartIcon, LocationIcon, LogoutIcon, UserIcon } from '@/components/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogout } from '@/features/session/use-auth'
import { useSession } from '@/features/session/use-session'

export function Avatar({ name, src, className = 'size-9' }: { name: string; src: string | null; className?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return src ? (
    <img src={src} alt="" className={`${className} rounded-full border border-primary object-cover`} />
  ) : (
    <span aria-hidden="true" className={`${className} flex items-center justify-center rounded-full border border-primary bg-raised text-xs font-bold text-highlight`}>
      {initials}
    </span>
  )
}

export function UserMenu() {
  const session = useSession()
  const logout = useLogout()
  if (!session) return null
  const { user } = session
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-0.5 hover:text-highlight" aria-label={`Menu da conta de ${user.displayName}`}>
        <Avatar name={user.displayName} src={user.avatarUrl} />
        <span className="hidden max-w-32 truncate text-sm lg:inline">{user.displayName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-line bg-card">
        <DropdownMenuLabel className="truncate text-sand">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/perfil">
            <UserIcon className="size-4 text-primary" /> Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/perfil/carteiras">
            <LocationIcon className="size-4 text-primary" /> Carteiras
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/perfil/favoritos">
            <HeartIcon className="size-4 text-primary" /> Lista de interesse
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()} className="font-bold text-highlight">
          <LogoutIcon className="size-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
