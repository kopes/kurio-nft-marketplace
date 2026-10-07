import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useState, type FormEvent, type ReactNode } from 'react'
import { CartIcon, LogoutIcon, SearchIcon } from '@/components/icons'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCart } from '@/features/cart/queries'
import { useSession } from '@/features/session/use-session'
import { useScrolled } from '@/hooks/use-scrolled'
import { cn } from '@/lib/utils'
import { UserMenu } from './user-menu'

const navItems = [
  { label: 'Início', to: '/', match: (path: string) => path === '/' },
  { label: 'Mercado', to: '/mercado', match: (path: string) => /^\/(mercado|nft|carrinho|pagamento|pedido)/.test(path) },
  { label: 'Criadores', to: '/em-breve', search: { secao: 'criadores' }, match: (path: string, search: string) => path === '/em-breve' && search.includes('criadores') },
  { label: 'Aprenda', to: '/em-breve', search: { secao: 'aprenda' }, match: (path: string, search: string) => path === '/em-breve' && search.includes('aprenda') },
] as const

export function KurioLogo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('text-sm font-bold tracking-[0.1em] text-foreground hover:text-highlight', className)} aria-label="Kurio, página inicial">
      KURIO
    </Link>
  )
}

export function CartLink({ className }: { className?: string }) {
  const cart = useCart()
  const count = cart.data?.totalQuantity ?? 0
  return (
    <Link
      to="/carrinho"
      className={cn(
        'relative flex size-10 items-center justify-center rounded-md text-foreground transition-[color,transform] duration-200 hover:text-highlight motion-safe:active:scale-90',
        className,
      )}
      aria-label={count ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}
    >
      <CartIcon className="h-6 w-[25px]" />
      {count > 0 && (
        // A chave muda com a contagem: o selo "salta" a cada item adicionado ou removido.
        <span
          key={count}
          aria-hidden="true"
          className="absolute top-0.5 right-0 flex min-w-4 animate-pop items-center justify-center rounded-full border-2 border-ink bg-primary px-0.5 text-[10px] leading-3 font-medium text-ink"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

export function SearchDialog({ open, onOpenChange, trigger }: { open: boolean; onOpenChange: (open: boolean) => void; trigger: ReactNode }) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onOpenChange(false)
    void navigate({ to: '/mercado', search: { q: term.trim() || undefined } })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* O gatilho registrado no Dialog recebe o foco de volta ao fechar. */}
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="top-24 translate-y-0 sm:max-w-xl">
        <DialogTitle>Buscar NFTs</DialogTitle>
        <DialogDescription className="text-sand">Pesquise por nome, token, coleção ou criador.</DialogDescription>
        <form role="search" onSubmit={submit} className="flex gap-2">
          <label htmlFor="global-search" className="sr-only">
            Termo de busca
          </label>
          <Input id="global-search" autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Ex.: Emerald Ape" maxLength={80} />
          <Button type="submit">Buscar</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Cabeçalho fixo a partir do tablet. No topo da página é idêntico ao Figma (transparente); ao rolar, sobe 12 px
 * e ganha fundo translúcido com desfoque, para o conteúdo passar por baixo sem perder a leitura.
 */
export function SiteHeader() {
  const location = useRouterState({ select: (state) => state.location })
  const session = useSession()
  const scrolled = useScrolled()
  const [searchOpen, setSearchOpen] = useState(false)
  const redirect = location.pathname === '/entrar' || location.pathname === '/cadastro' ? undefined : location.href

  return (
    <header
      data-scrolled={scrolled || undefined}
      className={cn(
        'sticky top-0 z-40 hidden pt-6 transition-[translate,background-color,box-shadow,backdrop-filter] duration-500 ease-out-expo [view-transition-name:site-header] md:block',
        scrolled && '-translate-y-3 bg-background/80 shadow-[0_12px_32px_-16px_rgb(8_5_4/0.9)] backdrop-blur-md backdrop-saturate-150',
      )}
    >
      <div className="container-page">
        <div className="relative flex h-[45px] items-start justify-between border-b border-primary/30">
          <div className="flex h-[34px] items-center lg:w-40">
            <KurioLogo />
          </div>
          <nav aria-label="Principal" className="absolute left-1/2 -translate-x-1/2">
            <ul className="flex gap-4 lg:gap-10">
              {navItems.map((item) => {
                const active = item.match(location.pathname, location.searchStr)
                return (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      search={'search' in item ? item.search : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        // Sublinhado no hover cresce do centro; o do item ativo desliza entre as páginas (view transition).
                        'relative block border-b-[3px] border-transparent pb-5 text-sm leading-[21px] transition-colors hover:text-highlight lg:text-base',
                        'after:absolute after:inset-x-0 after:-bottom-[3px] after:h-[3px] after:origin-center after:scale-x-0 after:bg-primary/50 after:transition-transform after:duration-300 after:ease-out-expo hover:after:scale-x-100',
                        active ? 'font-bold text-highlight' : 'text-foreground',
                      )}
                    >
                      {item.label}
                      {active && <span aria-hidden="true" className="absolute inset-x-0 -bottom-[3px] h-[3px] bg-primary [view-transition-name:nav-indicator]" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className="flex items-center gap-1 lg:gap-6">
            <SearchDialog
              open={searchOpen}
              onOpenChange={setSearchOpen}
              trigger={
                <button
                  type="button"
                  className="flex size-10 items-center justify-center rounded-md transition-[color,transform] duration-200 hover:text-highlight motion-safe:active:scale-90"
                  aria-label="Buscar NFTs"
                >
                  <SearchIcon className="size-5" />
                </button>
              }
            />
            <CartLink />
            {session ? (
              <UserMenu />
            ) : (
              <Link to="/entrar" search={{ redirect }} className={cn(buttonVariants({ size: 'sm' }), 'h-[35px] gap-1 px-2.5 text-base font-medium')}>
                <LogoutIcon className="size-5" />
                Entrar
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
