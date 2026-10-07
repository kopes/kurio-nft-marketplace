import { useState, type FormEvent } from 'react'
import { toApiError } from '@/api/errors'
import { EthPrice } from '@/components/nft/price'
import { Skeleton } from '@/components/ui/skeleton'
import type { Cart, Quote } from '@/shared/contracts'
import { isZeroEth, formatEth } from '@/shared/eth'
import { cn } from '@/lib/utils'
import { useApplyCoupon, useRemoveCoupon } from './queries'

/**
 * `sheet`: estilo do card de resumo do frame "Mobile / Carrinho de NFTs" (campo em pílula, sem rótulo visível).
 * Aplica-se só abaixo do breakpoint `md`; no desktop o formulário mantém o layout padrão.
 */
export function CouponForm({ cart, sheet = false }: { cart: Cart; sheet?: boolean }) {
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = code.trim()
    if (!value) {
      setError('Informe o código promocional')
      return
    }
    setError(null)
    apply.mutate(value, {
      onSuccess: () => setCode(''),
      onError: (failure) => {
        const apiError = toApiError(failure)
        setError(apiError.fieldErrors.code ?? apiError.message)
      },
    })
  }

  if (cart.couponCode) {
    return (
      <div className={cn('flex items-center justify-between gap-3 rounded-sm border border-primary/50 px-3 py-2 text-sm', sheet && 'max-md:min-h-12 max-md:rounded-full max-md:border-line max-md:px-4')} role="status">
        <span>
          Código <strong className="text-highlight">{cart.couponCode}</strong> aplicado
        </span>
        <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="text-xs text-khaki underline-offset-4 hover:text-highlight hover:underline">
          {remove.isPending ? 'Removendo…' : 'Remover'}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor="coupon-code" className={cn('text-sm font-bold', sheet && 'max-md:sr-only')}>
        Código promocional
      </label>
      <div
        className={cn(
          'flex h-10 overflow-hidden rounded-sm border border-primary',
          sheet && 'max-md:h-12 max-md:rounded-full max-md:border-line max-md:shadow-[0_6px_14px_rgb(8_5_4/0.35)]',
          error && 'border-destructive max-md:border-destructive',
        )}
      >
        <input
          id="coupon-code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Digite o código promocional..."
          maxLength={24}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'coupon-error' : 'coupon-hint'}
          className={cn(
            'min-w-0 flex-1 bg-transparent px-3 text-xs text-foreground outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring',
            sheet && 'max-md:rounded-l-full max-md:px-4',
          )}
        />
        <button
          type="submit"
          disabled={apply.isPending}
          className={cn(
            'bg-primary px-5 text-base font-bold text-ink hover:bg-highlight disabled:opacity-70',
            sheet && 'max-md:rounded-full max-md:bg-[linear-gradient(90deg,#865833,#cb8549)] max-md:px-4 max-md:text-sm max-md:text-cream max-md:hover:brightness-110',
          )}
        >
          {apply.isPending ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {error ? (
        <p id="coupon-error" role="alert" className="text-[13px] text-coral">
          ⚠ {error}
        </p>
      ) : (
        <p id="coupon-hint" className="sr-only">
          Códigos de exemplo: KURIO10, GENESIS
        </p>
      )}
    </form>
  )
}

/** `sheet`: tipografia e espaçamento do card de resumo mobile (sem divisória antes do total). */
export function QuoteLines({ quote, loading, cart, sheet = false, className }: { quote: Quote | undefined; loading: boolean; cart?: Cart; sheet?: boolean; className?: string }) {
  const row = cn('flex items-center justify-between text-[15px]', sheet && 'max-md:text-sm')
  const amount = cn('text-lg', sheet && 'max-md:text-[15px]')
  if (!quote) {
    return (
      <div className={cn('flex flex-col gap-4', className)} aria-busy="true" aria-label="Calculando resumo">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
        <div className={cn('flex justify-between border-t border-primary/30 pt-4', sheet && 'max-md:border-t-0 max-md:pt-0')}>
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-28" />
        </div>
      </div>
    )
  }
  const couponDropped = cart?.couponCode && !quote.coupon
  return (
    <dl className={cn('flex flex-col gap-3 transition-opacity', sheet && 'max-md:gap-2', loading && 'opacity-60', className)} aria-busy={loading}>
      <div className={row}>
        <dt>Subtotal</dt>
        <dd>
          <EthPrice value={quote.subtotal} className={amount} />
        </dd>
      </div>
      <div className={row}>
        <dt>{quote.coupon ? `Desconto (${quote.coupon.code})` : 'Desconto do lançamento'}</dt>
        <dd className={cn('tabular-nums', sheet && 'max-md:text-[15px]', !isZeroEth(quote.discount) && 'text-success-text')}>(-) {isZeroEth(quote.discount) ? '00.00' : `${formatEth(quote.discount)} ETH`}</dd>
      </div>
      {couponDropped && <p className="text-xs text-coral">O código {cart?.couponCode} não é aplicável ao carrinho atual.</p>}
      <div className="flex flex-col">
        <div className={row}>
          <dt>Taxa de rede</dt>
          <dd>
            <EthPrice value={quote.networkFee} className={amount} />
          </dd>
        </div>
        <p className={cn('self-end text-xs text-highlight', sheet && 'max-md:text-[11px]')}>Taxa estimada</p>
      </div>
      <div className={cn('flex items-center justify-between border-t border-primary/30 pt-4 text-[17px] font-bold', sheet && 'max-md:border-t-0 max-md:pt-0 max-md:text-[15px]')}>
        <dt>Total</dt>
        <dd>
          <EthPrice value={quote.total} className={cn('text-lg text-highlight', sheet && 'max-md:text-[17px]')} />
        </dd>
      </div>
    </dl>
  )
}
