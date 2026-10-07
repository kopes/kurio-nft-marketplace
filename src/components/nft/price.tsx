import { formatEth } from '@/shared/eth'
import { cn } from '@/lib/utils'

export function EthPrice({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn('tabular-nums', className)}>
      {formatEth(value)}&nbsp;ETH
    </span>
  )
}

/** Preço atual com o preço anterior riscado (quando há desconto). */
export function PriceWithCompare({ price, compareAtPrice, className }: { price: string; compareAtPrice: string | null; className?: string }) {
  return (
    <span className={cn('flex flex-wrap items-baseline gap-x-3', className)}>
      <EthPrice value={price} className="font-bold text-highlight" />
      {compareAtPrice && (
        <s className="font-normal text-khaki">
          <span className="sr-only">Preço anterior: </span>
          <EthPrice value={compareAtPrice} />
        </s>
      )}
    </span>
  )
}
