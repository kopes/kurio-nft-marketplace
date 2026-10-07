import { Link } from '@tanstack/react-router'
import type { FormEvent, ReactNode } from 'react'
import { MoreVerticalIcon, WalletIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { networkLabels, type NetworkId, type WalletProvider } from '@/shared/contracts'
import { cn } from '@/lib/utils'

/*
 * Peças do frame "Mobile / Pagamento" (414 × 896 no Figma). Medidas do frame: margens de 28 px, cards de carteira
 * com 93 px e raio 14, opções de aplicativo com 65 px e raio 15, rádios de 16 px (miolo de 8 px).
 */

/** Rede como aparece nos cards do frame ("Rede principal Ethereum", "Rede Polygon"). */
export function walletNetworkLine(network: NetworkId) {
  return network === 'ethereum' ? 'Rede principal Ethereum' : `Rede ${networkLabels[network]}`
}

export function RadioMark({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
        checked ? 'border-primary after:size-2 after:rounded-full after:bg-primary' : 'border-border',
        className,
      )}
    />
  )
}

interface WalletCardProps {
  title: string
  address: string
  network: string
  checked: boolean
  onSelect: () => void
  menu: ReactNode
}

/** Card de carteira: o card inteiro é o rádio; o menu (⋮) fica sobreposto à direita, fora do botão. */
export function MobileWalletCard({ title, address, network, checked, onSelect, menu }: WalletCardProps) {
  return (
    <div className="relative">
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        onClick={onSelect}
        className="flex min-h-[93px] w-full items-center gap-[18px] rounded-[14px] bg-card pt-[13px] pr-12 pb-[11px] pl-[19px] text-left"
      >
        <RadioMark checked={checked} />
        <span className="mt-px flex min-w-0 flex-col self-start">
          <span className="truncate text-base leading-5 font-bold">{title}</span>
          <span className="mt-1 truncate text-sm leading-[22px] text-sand">{address}</span>
          <span className="truncate text-sm leading-[22px] text-sand">{network}</span>
        </span>
      </button>
      {menu}
    </div>
  )
}

interface WalletMenuProps {
  name: string
  selected: boolean
  connected: boolean
  busy: boolean
  onSelect?: () => void
  onConnect: () => void
  onDisconnect: () => void
  onEditDetails: () => void
}

/** Ações da carteira (⋮): conexão simulada, dados do pagamento e cadastro de carteiras. */
export function WalletMenu({ name, selected, connected, busy, onSelect, onConnect, onDisconnect, onEditDetails }: WalletMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Mais ações da carteira ${name}`}
        className="absolute top-1/2 right-[4.5px] flex h-10 w-8 -translate-y-1/2 items-center justify-center rounded-md text-khaki hover:text-highlight data-[state=open]:text-highlight"
      >
        <MoreVerticalIcon className="h-[15px] w-[3px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 border-line bg-card">
        {!selected && onSelect ? (
          <DropdownMenuItem onSelect={onSelect}>Usar esta carteira</DropdownMenuItem>
        ) : connected ? (
          <DropdownMenuItem onSelect={onDisconnect} disabled={busy}>
            Desconectar carteira
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onConnect} disabled={busy}>
            Conectar carteira
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onEditDetails}>Editar dados do pagamento</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/perfil/carteiras">Gerenciar carteiras</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Marca do aplicativo: letra em cobre (deslocada à esquerda, como no frame) ou o ícone de carteira para a Coinbase. */
function ProviderMark({ id }: { id: WalletProvider }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-10 shrink-0 items-center rounded-full border border-line bg-raised text-highlight',
        id === 'coinbase' ? 'justify-center' : 'pl-[12.5px] text-sm leading-none font-bold',
      )}
    >
      {id === 'coinbase' ? <WalletIcon className="size-6" /> : id === 'metamask' ? 'M' : 'W'}
    </span>
  )
}

export function ProviderOption({ id, label, checked, onSelect }: { id: WalletProvider; label: string; checked: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="flex h-[65px] w-full items-center gap-[11px] rounded-[15px] bg-card pr-4 pl-3.5 text-left text-sm leading-5"
    >
      <ProviderMark id={id} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <RadioMark checked={checked} />
    </button>
  )
}

interface DetailsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenAutoFocus: (event: Event) => void
  onDone: () => void
  children: ReactNode
}

/**
 * Dados do pagamento no mobile. O frame mostra só carteiras, aplicativo e total; os dados do colecionador
 * (pré-preenchidos pelo perfil e pela carteira) ficam nesta folha, aberta por "Trocar carteira", pelo menu ⋮
 * ou automaticamente quando a validação encontra erros.
 */
export function CheckoutDetailsSheet({ open, onOpenChange, onOpenAutoFocus, onDone, children }: DetailsSheetProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onDone()
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onOpenAutoFocus={onOpenAutoFocus}
        className="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-[32px] border-0 px-7 pt-7 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="gap-1 p-0 pr-8">
          <SheetTitle className="text-lg font-bold">Dados do pagamento</SheetTitle>
          <SheetDescription className="text-sand">Carteira de destino e dados do colecionador usados no pedido.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-6">
          {children}
          <Button type="submit" className="h-12 rounded-full bg-[linear-gradient(100deg,#d28a4c,#b57742)] text-[15px] hover:brightness-110">
            Concluir
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
