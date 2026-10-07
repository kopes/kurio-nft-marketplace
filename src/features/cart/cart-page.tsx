import { Link, useNavigate } from '@tanstack/react-router'
import { Minus, Plus } from 'lucide-react'
import { useEffect } from 'react'
import { DeleteIcon } from '@/components/icons'
import { Breadcrumbs } from '@/components/common/breadcrumbs'
import { QuantityStepper } from '@/components/common/quantity-stepper'
import { BackgroundRefresh, EmptyState, ErrorState } from '@/components/common/states'
import { MobileTopBar } from '@/components/layout/mobile-top-bar'
import { NftImage } from '@/components/nft/nft-image'
import { EthPrice } from '@/components/nft/price'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { CartItem } from '@/shared/contracts'
import { formatEth } from '@/shared/eth'
import { cn } from '@/lib/utils'
import { realtimeClient } from '@/features/realtime/realtime-client'
import { useNftList } from '@/features/catalog/queries'
import { NftCarousel } from '@/features/nft/related-carousel'
import { useSession } from '@/features/session/use-session'
import { CartNoticesList } from './cart-notices-list'
import { CouponForm, QuoteLines } from './cart-summary'
import { useCart, useQuote, useRemoveCartItem, useUpdateCartItem } from './queries'

const BLOCKING = new Set(['SOLD_OUT', 'UNAVAILABLE', 'INSUFFICIENT_STOCK'])

function ItemIssue({ item }: { item: CartItem }) {
  if (!item.issue) return null
  const text = {
    PRICE_CHANGED: item.previousUnitPrice ? `Preço atualizado (antes ${formatEth(item.previousUnitPrice)} ETH)` : 'Preço atualizado',
    INSUFFICIENT_STOCK: `Restam ${item.available} unidade(s): ajuste a quantidade`,
    SOLD_OUT: 'Edição esgotada: remova o item',
    UNAVAILABLE: 'Edição indisponível: remova o item',
  }[item.issue]
  return <p className={cn('text-xs font-medium', item.issue === 'PRICE_CHANGED' ? 'text-amber' : 'text-coral')}>⚠ {text}</p>
}

/** Assina eventos dos NFTs presentes no carrinho enquanto a página estiver aberta. */
function useCartSubscriptions(items: CartItem[] | undefined) {
  const ids = items?.map((item) => item.nftId).sort().join(',') ?? ''
  useEffect(() => {
    if (!ids) return
    const releases = ids.split(',').map((id) => realtimeClient.subscribe(`nft:${id}`))
    return () => releases.forEach((release) => release())
  }, [ids])
}

/**
 * Seletor do frame "Mobile / Carrinho de NFTs": círculos discretos com ícone claro.
 * Na quantidade mínima (ou com a edição esgotada/indisponível), o "−" vira o botão de remover.
 */
function MobileCartStepper({
  item,
  onChange,
  onRemove,
  disabled,
  removing,
  className,
}: {
  item: CartItem
  onChange: (quantity: number) => void
  onRemove: () => void
  disabled: boolean
  removing: boolean
  className?: string
}) {
  const circle =
    'flex size-6 items-center justify-center rounded-full border border-line bg-raised text-cream transition-colors hover:border-primary disabled:cursor-not-allowed disabled:text-[#4b2c1c] disabled:hover:border-line'
  const showRemove = item.quantity <= 1 || item.issue === 'SOLD_OUT' || item.issue === 'UNAVAILABLE'
  const max = Math.max(1, item.maxQuantity || item.quantity)
  return (
    <div role="group" aria-label={item.name} className={cn('flex items-center gap-2.5', className)}>
      {showRemove ? (
        <button type="button" className={cn(circle, 'text-primary hover:text-highlight')} onClick={onRemove} disabled={removing} aria-label={`Remover ${item.name} do carrinho`}>
          <DeleteIcon className="size-3.5" />
        </button>
      ) : (
        <button type="button" className={circle} onClick={() => onChange(item.quantity - 1)} disabled={disabled} aria-label={`Diminuir quantidade de ${item.name}`}>
          <Minus className="size-3" strokeWidth={3} aria-hidden="true" />
        </button>
      )}
      <output aria-live="polite" className="min-w-3 text-center text-sm tabular-nums">
        {item.quantity}
      </output>
      <button type="button" className={circle} onClick={() => onChange(item.quantity + 1)} disabled={disabled || item.quantity >= max} aria-label={`Aumentar quantidade de ${item.name}`}>
        <Plus className="size-3" strokeWidth={3} aria-hidden="true" />
      </button>
    </div>
  )
}

function CartRow({ item }: { item: CartItem }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const max = Math.max(item.maxQuantity, item.issue === 'INSUFFICIENT_STOCK' ? item.available : item.quantity)
  const changeQuantity = (quantity: number) => update.mutate({ itemId: item.id, quantity, name: item.name })
  const removeItem = () => remove.mutate({ itemId: item.id, name: item.name })
  const locked = item.issue === 'SOLD_OUT' || item.issue === 'UNAVAILABLE' || remove.isPending
  const stepper = (
    <QuantityStepper
      size="sm"
      value={item.quantity}
      max={Math.max(1, item.maxQuantity || item.quantity)}
      onChange={changeQuantity}
      label={item.name}
      disabled={locked}
    />
  )
  const removeButton = (
    <button
      type="button"
      onClick={removeItem}
      disabled={remove.isPending}
      aria-label={`Remover ${item.name} do carrinho`}
      className="flex size-9 items-center justify-center rounded-sm text-khaki hover:text-coral disabled:opacity-50"
    >
      <DeleteIcon className="size-6" />
    </button>
  )
  return (
    <li className={cn('transition-[opacity,background-color] duration-300 md:bg-card md:hover:bg-raised/60', remove.isPending && 'opacity-60')} data-testid="cart-item" data-max={max}>
      {/* Desktop: linha da tabela */}
      <div className="hidden min-h-[70px] grid-cols-[250px_1fr_1fr_1fr_40px] items-center gap-4 pr-6 md:grid lg:grid-cols-[250px_140px_136px_148px_1fr]">
        <div className="flex items-center gap-4">
          <NftImage artwork={item.artwork} alt="" sizes="70px" className="size-[70px] shrink-0 rounded-md" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <Link to="/nft/$nftId" params={{ nftId: item.nftId }} search={{ edicao: item.editionId }} className="truncate text-base leading-4 font-bold hover:text-highlight">
              {item.name}
            </Link>
            <span className="text-sm leading-4 text-khaki">ID do token: {item.tokenId}</span>
          </div>
        </div>
        <div className="flex flex-col">
          <EthPrice value={item.unitPrice} className="text-base font-bold text-sand" />
        </div>
        <div className="flex flex-col gap-1">
          {stepper}
          <span className="text-xs text-khaki">Edição {item.editionLabel}</span>
        </div>
        <EthPrice value={item.lineTotal} className="text-base font-bold text-highlight" />
        <div className="flex justify-end">{removeButton}</div>
        {item.issue && (
          <div className="col-span-full pb-3 pl-[86px]">
            <ItemIssue item={item} />
          </div>
        )}
      </div>
      {/*
       * Mobile: card do frame "Mobile / Carrinho de NFTs". O nome ocupa a largura toda (o seletor,
       * centralizado na vertical, fica abaixo da linha do nome); edição, aviso e preço ficam à esquerda dele.
       */}
      <div className="flex min-h-[94px] overflow-hidden rounded-xl bg-card shadow-[0_10px_18px_rgb(8_5_4/0.45)] md:hidden">
        <div className="relative w-[94px] shrink-0">
          <NftImage artwork={item.artwork} alt="" sizes="94px" className="absolute inset-0 size-full" />
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto_1fr] gap-x-2 py-3 pr-4 pl-2.5">
          <Link
            to="/nft/$nftId"
            params={{ nftId: item.nftId }}
            search={{ edicao: item.editionId }}
            className="col-start-1 col-end-3 row-start-1 truncate text-sm leading-[17px] font-bold hover:text-highlight"
          >
            {item.name}
          </Link>
          <div className="col-start-1 row-start-2 flex flex-col gap-1">
            <p className="text-[13px] leading-4 text-sand">Edição: {item.editionLabel}</p>
            <ItemIssue item={item} />
          </div>
          <EthPrice value={item.lineTotal} className="col-start-1 row-start-3 mt-2 self-end text-[17px] leading-5 font-bold text-highlight" />
          <MobileCartStepper
            item={item}
            onChange={changeQuantity}
            onRemove={removeItem}
            disabled={locked}
            removing={remove.isPending}
            className="col-start-2 row-start-1 row-end-4 self-center"
          />
        </div>
      </div>
    </li>
  )
}

function CartSkeleton() {
  return (
    <ul className="flex flex-col gap-5 md:gap-3" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <li key={index} className="flex h-[94px] items-center gap-4 overflow-hidden rounded-xl bg-card pr-6 md:h-[70px] md:rounded-none">
          <Skeleton className="size-[94px] rounded-none md:size-[70px] md:rounded-md" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-20" />
        </li>
      ))}
    </ul>
  )
}

export function CartPage() {
  const cart = useCart()
  const quote = useQuote('ethereum', 'cart')
  const session = useSession()
  const navigate = useNavigate()
  const suggestions = useNftList({ tab: 'em-alta', pageSize: 10, page: 1, sort: 'recentes' })
  useCartSubscriptions(cart.data?.items)

  const items = cart.data?.items ?? []
  const blocked = items.some((item) => item.issue && BLOCKING.has(item.issue))
  const empty = cart.data && items.length === 0

  const checkout = () => {
    if (!session) {
      void navigate({ to: '/entrar', search: { redirect: '/pagamento' } })
      return
    }
    void navigate({ to: '/pagamento' })
  }

  // Mobile: a página ocupa a altura da tela e o resumo é um card preso ao rodapé (frame "Mobile / Carrinho de NFTs").
  return (
    <div className="container-page pb-6 max-md:flex max-md:min-h-dvh max-md:flex-col max-md:px-6 max-md:pb-0">
      <MobileTopBar title="Carrinho de NFTs" fallback="/mercado" className="pt-8" />
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: 'Carrinho' }]} className="pt-10" />
      <h1 className="sr-only max-md:hidden">Carrinho de NFTs</h1>

      <div className="mt-2 flex flex-col gap-10 max-md:flex-1 max-md:gap-6 md:mt-1 lg:flex-row lg:gap-[86px]">
        <section aria-labelledby="cart-items-title" className="flex min-w-0 flex-1 flex-col gap-3 max-md:flex-none lg:max-w-[782px]">
          <h2 id="cart-items-title" className="sr-only">
            Itens do carrinho
          </h2>
          <div className="hidden grid-cols-[250px_1fr_1fr_1fr_40px] gap-4 border-b border-primary/30 pr-6 pb-3 text-base leading-4 md:grid lg:grid-cols-[250px_140px_136px_148px_1fr]" aria-hidden="true">
            <span className="font-bold">NFTs</span>
            <span className="font-medium">Preço</span>
            <span className="font-bold">Edições</span>
            <span className="font-medium">Total</span>
            <span />
          </div>
          <CartNoticesList />
          {cart.isPending ? (
            <CartSkeleton />
          ) : cart.isError ? (
            <ErrorState error={cart.error} title="Não foi possível carregar o carrinho" onRetry={() => void cart.refetch()} retrying={cart.isFetching} />
          ) : empty ? (
            <EmptyState
              title="Seu carrinho está vazio"
              description="Explore o mercado e adicione NFTs para continuar."
              action={
                <Link to="/mercado" className={buttonVariants()}>
                  Explorar o mercado
                </Link>
              }
            />
          ) : (
            <ul className="stagger-children flex flex-col gap-5 md:gap-3" aria-label={`${items.length} itens no carrinho`}>
              {items.map((item) => (
                <CartRow key={item.id} item={item} />
              ))}
            </ul>
          )}
          <BackgroundRefresh active={cart.isFetching && !cart.isPending} />
        </section>

        {/* Mobile: card de resumo sem título visível, preso ao rodapé enquanto a lista rola por baixo. */}
        <aside
          aria-labelledby="summary-title"
          className={cn(
            'flex w-full animate-fade-up stagger-2 flex-col gap-5 lg:w-[332px]',
            'max-md:sticky max-md:bottom-0 max-md:z-10 max-md:mt-auto max-md:-mx-6 max-md:w-auto max-md:gap-3 max-md:rounded-[32px] max-md:bg-card max-md:px-5.5 max-md:pt-6 max-md:pb-[calc(2rem+env(safe-area-inset-bottom))] max-md:shadow-[0_-12px_32px_rgb(8_5_4/0.55)]',
            empty && 'max-md:hidden',
          )}
        >
          <h2 id="summary-title" className="border-b border-primary/30 pb-3 text-lg leading-4 font-bold max-md:sr-only">
            Resumo da carteira
          </h2>
          {cart.data && !empty && <CouponForm cart={cart.data} sheet />}
          {cart.data && !empty ? (
            quote.isError && !quote.data ? (
              <ErrorState error={quote.error} title="Não foi possível calcular o total" onRetry={() => void quote.refetch()} retrying={quote.isFetching} className="py-6" />
            ) : (
              <QuoteLines quote={quote.data} loading={quote.isFetching} cart={cart.data} sheet />
            )
          ) : cart.isPending ? (
            <QuoteLines quote={undefined} loading sheet />
          ) : (
            <p className="text-sm text-sand">Adicione itens para ver o resumo.</p>
          )}
          <Button
            onClick={checkout}
            disabled={!cart.data || Boolean(empty) || blocked || !quote.data}
            className="h-10 w-full text-[15px] max-md:mt-3.5 max-md:h-14 max-md:rounded-full max-md:bg-[linear-gradient(100deg,#d28a4c,#b57742)] max-md:hover:brightness-110"
          >
            Conectar e finalizar
          </Button>
          {blocked && <p className="text-sm text-coral">Resolva os itens indisponíveis para continuar.</p>}
          {!session && !empty && <p className="text-xs text-khaki max-md:hidden">Você poderá entrar ou criar uma conta; seus itens serão mantidos.</p>}
          <Link to="/mercado" className="text-center text-[15px] text-highlight hover:underline max-md:hidden">
            Continuar explorando
          </Link>
        </aside>
      </div>

      {/* O frame mobile não tem sugestões; elas só aparecem lá quando o carrinho está vazio. */}
      <div className={cn(!empty && 'max-md:hidden')}>
        <NftCarousel id="also-viewed" title="Colecionadores também viram" items={suggestions.data?.items} loading={suggestions.isPending} />
      </div>
    </div>
  )
}
