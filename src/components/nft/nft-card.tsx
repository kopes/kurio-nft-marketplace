import { Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { Heart } from 'lucide-react'
import { CartIcon, HeartIcon, HeartSolidIcon } from '@/components/icons'
import { Skeleton } from '@/components/ui/skeleton'
import type { NftSummary } from '@/shared/contracts'
import { cn } from '@/lib/utils'
import { NftImage } from './nft-image'
import { PriceWithCompare } from './price'

interface NftCardProps {
  nft: NftSummary
  favorite?: boolean
  onToggleFavorite?: (nft: NftSummary) => void
  onQuickAdd?: (nft: NftSummary) => void
  /** Coluna na grade mobile: a arte fica 12 px (esquerda) ou 20 px (direita) abaixo do topo do card. */
  column?: 'left' | 'right'
  priority?: boolean
  sizes?: string
  className?: string
  /** Permite escalonar a animação de entrada (`animationDelay`) a partir da grade. */
  style?: CSSProperties
}

/**
 * Card do catálogo. O link ocupa o card inteiro (padrão "stretched link") e as ações
 * rápidas são botões irmãos — nunca elementos interativos aninhados.
 *
 * Desktop: frame 258×300 com arte 250 px (Figma "Desktop / Início").
 * Mobile: frame 175×200, raio 20, gradiente #241612→#2F1D15, arte raio 16 e
 * apenas o favorito circular de 28 px no canto (Figma "Mobile / Início").
 */
export function NftCard({ nft, favorite, onToggleFavorite, onQuickAdd, column = 'left', priority, sizes = '(min-width: 1024px) 250px, 45vw', className, style }: NftCardProps) {
  const soldOut = nft.available === 0
  return (
    <article
      className={cn(
        // Hover (mouse): o card sobe e ganha um halo cobre; toque: afunda levemente. Sem movimento com `prefers-reduced-motion`.
        'group relative flex flex-col gap-2 transition-[translate,scale] duration-500 ease-out-expo md:gap-3 motion-safe:active:scale-[0.98] motion-safe:md:hover:-translate-y-1.5',
        className,
      )}
      style={style}
      aria-labelledby={`nft-${nft.id}-title`}
    >
      <div
        className={cn(
          'relative flex aspect-[175/200] items-start justify-center rounded-[20px] bg-[linear-gradient(135deg,#241612_0%,#2f1d15_100%)] px-1',
          column === 'left' ? 'pt-3' : 'pt-5',
          'md:aspect-[258/300] md:items-center md:rounded-none md:bg-card md:bg-none md:p-1 md:transition-[background-color,box-shadow] md:duration-500 md:group-hover:bg-raised md:group-hover:shadow-[0_22px_44px_-24px_rgb(232_155_85/0.55)]',
        )}
      >
        {/* Moldura com recorte: a arte amplia dentro dela sem vazar os cantos arredondados. */}
        <div className="isolate aspect-square w-full overflow-hidden rounded-2xl md:w-[97%] md:rounded-[15px]">
          <NftImage
            artwork={nft.artwork}
            alt=""
            sizes={sizes}
            priority={priority}
            className="size-full transition-transform duration-700 ease-out-expo motion-safe:group-hover:scale-[1.06]"
          />
        </div>
        {nft.rarity && (
          <span
            className={cn(
              'absolute left-0 flex h-8 w-[68px] items-center bg-primary pl-2 text-[13px] leading-4 font-medium text-ink uppercase',
              column === 'left' ? 'top-3' : 'top-5',
              'md:top-0 md:h-auto md:w-auto md:px-3.5 md:py-1.5 md:text-[15px]',
            )}
          >
            {nft.rarity === 'raro' ? 'Raro' : 'Lendário'}
          </span>
        )}
        {soldOut && <span className="absolute bottom-3 left-2 rounded-sm bg-ink/85 px-2 py-1 text-xs font-bold text-coral md:top-2 md:right-2 md:bottom-auto md:left-auto">Esgotado</span>}

        {onToggleFavorite && (
          <button
            type="button"
            onClick={() => onToggleFavorite(nft)}
            aria-pressed={Boolean(favorite)}
            aria-label={`Favoritar ${nft.name}`}
            className="absolute top-3 right-2.5 z-10 flex size-7 items-center justify-center rounded-full border border-line bg-raised text-primary transition-[scale] duration-300 ease-spring motion-safe:active:scale-85 md:hidden"
          >
            {/* Contorno (como no Figma) quando não favoritado; preenchido (com um "salto") quando favoritado. */}
            {favorite ? <HeartSolidIcon key="on" className="h-[13px] w-[15px] animate-pop" /> : <HeartIcon key="off" className="size-[15px]" />}
          </button>
        )}

        {(onToggleFavorite || onQuickAdd) && (
          <div className="absolute inset-x-0 bottom-3 z-10 hidden translate-y-1.5 justify-center gap-1.5 opacity-0 transition-[opacity,translate] duration-300 ease-out-expo group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 md:flex">
            {onQuickAdd && (
              <button
                type="button"
                onClick={() => onQuickAdd(nft)}
                disabled={soldOut}
                aria-label={`Adicionar ${nft.name} ao carrinho`}
                className="flex size-[35px] items-center justify-center rounded-sm bg-ink/90 text-foreground backdrop-blur-sm transition-[color,scale] duration-200 hover:text-highlight motion-safe:active:scale-90 disabled:opacity-50"
              >
                <CartIcon className="h-[18px] w-[19px]" />
              </button>
            )}
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(nft)}
                aria-pressed={Boolean(favorite)}
                aria-label={`Favoritar ${nft.name}`}
                className={cn(
                  'flex size-[35px] items-center justify-center rounded-sm bg-ink/90 backdrop-blur-sm transition-[color,scale] duration-200 hover:text-highlight motion-safe:active:scale-90',
                  favorite ? 'text-highlight' : 'text-foreground',
                )}
              >
                {favorite ? <Heart key="on" className="size-[18px] animate-pop" fill="currentColor" aria-hidden="true" /> : <HeartIcon key="off" className="size-[18px]" />}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col pl-2 md:gap-1.5 md:pl-0">
        <h3 id={`nft-${nft.id}-title`} className="text-[15px] leading-5 font-normal md:text-base md:leading-4">
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className="outline-none transition-colors group-hover:text-highlight after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-solid focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
          >
            {nft.name}
          </Link>
        </h3>
        <PriceWithCompare price={nft.price} compareAtPrice={nft.compareAtPrice} className="text-base leading-4 md:text-lg md:leading-5" />
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 md:gap-3" aria-hidden="true">
      <Skeleton className="aspect-[175/200] w-full rounded-[20px] md:aspect-[258/300] md:rounded-none" />
      <Skeleton className="ml-2 h-4 w-3/4 md:ml-0" />
      <Skeleton className="ml-2 h-4 w-1/3 md:ml-0 md:h-5" />
    </div>
  )
}
