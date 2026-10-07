import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { NftImage } from '@/components/nft/nft-image'
import { EthPrice } from '@/components/nft/price'
import { Skeleton } from '@/components/ui/skeleton'
import type { NftSummary } from '@/shared/contracts'
import { cn } from '@/lib/utils'
import { useNftList } from '@/features/catalog/queries'

/** Carrossel horizontal com scroll-snap; os pontos indicam/navegam entre páginas. */
export function NftCarousel({ items, loading, title, id }: { items: NftSummary[] | undefined; loading: boolean; title: string; id: string }) {
  const scroller = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(1)

  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const update = () => {
      const total = Math.max(1, Math.ceil(element.scrollWidth / element.clientWidth - 0.05))
      setPages(total)
      setPage(Math.min(total - 1, Math.round(element.scrollLeft / element.clientWidth)))
    }
    update()
    element.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      element.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [items])

  const goTo = (index: number) => scroller.current?.scrollTo({ left: index * scroller.current.clientWidth, behavior: 'smooth' })

  return (
    <section aria-labelledby={id} className="reveal mt-16 md:mt-24">
      <h2 id={id} className="border-b border-primary/30 pb-3 text-[17px] leading-4 font-bold text-highlight">
        {title}
      </h2>
      <ul ref={scroller} className="mt-8 flex snap-x snap-mandatory gap-7 overflow-x-auto pb-2 [scrollbar-width:none]" aria-busy={loading}>
        {loading || !items
          ? Array.from({ length: 5 }, (_, index) => (
              <li key={index} className="w-[45%] shrink-0 sm:w-[30%] lg:w-[calc((100%-112px)/5)]">
                <Skeleton className="aspect-[219/255] w-full rounded-none" />
                <Skeleton className="mt-3 h-4 w-3/4" />
                <Skeleton className="mt-2 h-4 w-1/3" />
              </li>
            ))
          : items.map((item) => (
              <li key={item.id} className="w-[45%] shrink-0 snap-start sm:w-[30%] lg:w-[calc((100%-112px)/5)]">
                <article className="group relative flex flex-col gap-3 transition-[translate,scale] duration-500 ease-out-expo motion-safe:active:scale-[0.98] motion-safe:md:hover:-translate-y-1.5">
                  <div className="flex aspect-[219/255] items-center justify-center bg-card p-1 transition-[background-color,box-shadow] duration-500 group-hover:bg-raised md:group-hover:shadow-[0_22px_44px_-24px_rgb(232_155_85/0.55)]">
                    <div className="isolate aspect-square w-[95%] overflow-hidden rounded-xl">
                      <NftImage
                        artwork={item.artwork}
                        alt=""
                        sizes="(min-width: 1024px) 220px, 45vw"
                        className="size-full transition-transform duration-700 ease-out-expo motion-safe:group-hover:scale-[1.06]"
                      />
                    </div>
                  </div>
                  <h3 className="text-[15px] leading-5">
                    <Link to="/nft/$nftId" params={{ nftId: item.id }} className="transition-colors group-hover:text-highlight after:absolute after:inset-0">
                      {item.name}
                    </Link>
                  </h3>
                  <EthPrice value={item.price} className="-mt-3 text-base leading-4 font-bold text-highlight" />
                </article>
              </li>
            ))}
      </ul>
      {pages > 1 && (
        <div className="mt-6 flex justify-center gap-2" role="group" aria-label={`Páginas de ${title}`}>
          {Array.from({ length: pages }, (_, index) => (
            <button key={index} type="button" onClick={() => goTo(index)} aria-label={`Ir para a página ${index + 1}`} aria-pressed={index === page} className="flex size-6 items-center justify-center">
              <span className={cn('size-3 rounded-full border border-primary transition-[background-color,scale] duration-300 ease-spring', index === page ? 'bg-primary' : 'hover:scale-125')} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export function RelatedCarousel({ nft }: { nft: NftSummary }) {
  const related = useNftList({ collections: [nft.collection], exclude: nft.id, pageSize: 10, sort: 'recentes', tab: 'todos', page: 1 })
  if (related.data && related.data.items.length === 0) return null
  return <NftCarousel id="related-title" title="Mais desta coleção" items={related.data?.items} loading={related.isPending} />
}
