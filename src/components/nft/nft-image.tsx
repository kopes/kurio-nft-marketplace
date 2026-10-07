import { useCallback, useState } from 'react'
import type { ArtworkId } from '@/shared/contracts'
import { cn } from '@/lib/utils'

const widths = [240, 480, 720, 960] as const

export function artworkSrc(artwork: ArtworkId, width: (typeof widths)[number] = 480) {
  return `/nfts/${artwork}-${width}.webp`
}

function artworkSrcSet(artwork: ArtworkId) {
  return widths.map((width) => `${artworkSrc(artwork, width)} ${width}w`).join(', ')
}

/**
 * Baixa a arte na mesma resolução que o `<img>` escolheria (mesmos `srcset`/`sizes`), para ela aparecer
 * sem shimmer quando for exibida (ex.: ao passar o mouse no ponto do carrossel, antes do clique).
 */
export function preloadArtwork(artwork: ArtworkId, sizes: string) {
  const image = new Image()
  image.sizes = sizes
  image.srcset = artworkSrcSet(artwork)
  image.src = artworkSrc(artwork)
}

interface NftImageProps {
  artwork: ArtworkId
  alt: string
  /** Atributo `sizes` para o navegador escolher a resolução adequada. */
  sizes: string
  className?: string
  priority?: boolean
}

/**
 * Arte do NFT em WebP responsivo (240–960 px), com dimensões fixas para evitar CLS e shimmer até carregar.
 * Ao chegar da rede, a arte sai do desfoque (exceto as prioritárias); se já estava na memória do navegador, aparece direto (sem shimmer nem animação).
 */
export function NftImage({ artwork, alt, sizes, className, priority = false }: NftImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'cached'>('loading')
  // `complete` já vem verdadeiro na montagem quando a imagem está em cache: marca antes da primeira pintura.
  const detectCached = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) setStatus('cached')
  }, [])
  return (
    <img
      ref={detectCached}
      src={artworkSrc(artwork)}
      srcSet={artworkSrcSet(artwork)}
      sizes={sizes}
      alt={alt}
      width={480}
      height={480}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      onLoad={() => setStatus((current) => (current === 'loading' ? 'loaded' : current))}
      // Artes prioritárias (LCP, acima da dobra) aparecem nítidas na hora, sem a transição de desfoque.
      className={cn('aspect-square h-auto w-full object-cover', status === 'loading' ? 'skeleton' : 'bg-raised', status === 'loaded' && !priority && 'animate-image-in', className)}
    />
  )
}
