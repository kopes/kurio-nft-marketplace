import { useNavigate } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { useMemo, useState } from 'react'
import { HeartIcon, LinkedinIcon, MessageIcon, SearchIcon, ShopIcon, StarIcon, TwitterIcon } from '@/components/icons'
import { Breadcrumbs } from '@/components/common/breadcrumbs'
import { QuantityStepper } from '@/components/common/quantity-stepper'
import { NotFound } from '@/components/common/not-found'
import { ErrorState } from '@/components/common/states'
import { MobileTopBar } from '@/components/layout/mobile-top-bar'
import { NftImage, artworkSrc, preloadArtwork } from '@/components/nft/nft-image'
import { EthPrice, PriceWithCompare } from '@/components/nft/price'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { networkLabels, type EditionId, type NftDetail } from '@/shared/contracts'
import { mulEth } from '@/shared/eth'
import { toApiError } from '@/api/errors'
import { cn } from '@/lib/utils'
import { useAddToCart } from '@/features/cart/queries'
import { useNftDetail } from '@/features/catalog/queries'
import { useFavorites, useToggleFavorite } from '@/features/favorites/queries'
import { useRealtimeTopic } from '@/features/realtime/realtime-bridge'
import { RelatedCarousel } from './related-carousel'

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn('flex gap-1 text-primary', className)} aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <StarIcon key={index} className={cn('size-[15px]', index + 0.5 > rating && 'opacity-35')} />
      ))}
    </span>
  )
}

/** Selo de nota do frame mobile ("★ 4.8 (19)"). */
function RatingPill({ rating, reviewsCount, className }: { rating: number; reviewsCount: number; className?: string }) {
  return (
    <p className={cn('flex h-[27px] shrink-0 items-center gap-1 rounded-full border border-primary px-1.5 text-sm leading-4', className)}>
      <StarIcon className="size-3.5 text-amber" />
      <span aria-hidden="true">
        <span className="font-medium">{rating.toFixed(1)}</span>
        <span className="text-sand">({reviewsCount})</span>
      </span>
      <span className="sr-only">
        Nota {rating.toFixed(1)} de 5, {reviewsCount} avaliações
      </span>
    </p>
  )
}

/**
 * Frame "Mobile / Detalhes do NFT": hero em gradiente com a arte 361×356 e a folha de detalhes
 * subindo 30 px sobre a arte. A folha ocupa ao menos o restante da primeira tela
 * (topo = 36 px + altura da arte), para a barra de compra fixa sempre repousar sobre ela, como no frame.
 */
const mobileHero = 'max-md:-mx-4 max-md:bg-linear-141 max-md:from-surface max-md:to-raised max-md:pr-[25px] max-md:pl-7'
const mobileSheet =
  'relative max-md:-mx-4 max-md:-mt-[30px] max-md:min-h-[calc(100dvh-36px-(100vw-53px)*356/361)] max-md:rounded-t-[31px] max-md:bg-card max-md:px-6 max-md:pt-8 max-md:pb-6'

const mainImageSizes = '(min-width: 768px) 404px, 100vw'

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/** Reserva também o espaço das abas e do carrossel para o rodapé não se deslocar (CLS). */
function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando NFT">
      <Skeleton className="mt-8 mb-4 hidden h-5 w-72 md:block" />
      <DetailSkeletonTop />
      <Skeleton className="mt-16 h-8 w-80 md:mt-24" />
      <Skeleton className="mt-4 h-[300px] w-full" />
      <Skeleton className="mt-16 h-5 w-48 md:mt-24" />
      <div className="mt-8 flex gap-7 overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="aspect-[219/255] w-[45%] shrink-0 rounded-none sm:w-[30%] lg:w-[calc((100%-112px)/5)]" />
        ))}
      </div>
    </div>
  )
}

function DetailSkeletonTop() {
  return (
    <div className="flex flex-col md:flex-row md:gap-10">
      <div className={cn(mobileHero, 'max-md:pt-[23px]')}>
        <div className="mb-2 flex justify-between md:hidden">
          <Skeleton className="size-[35px] rounded-full" />
          <Skeleton className="size-[35px] rounded-full" />
        </div>
        <div className="flex gap-7">
          <div className="hidden flex-col gap-4 lg:flex">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="size-[100px] rounded-lg" />
            ))}
          </div>
          <Skeleton className="aspect-[361/356] w-full rounded-3xl md:aspect-square md:w-[min(444px,42vw)] md:rounded-md" />
        </div>
      </div>
      <div className={cn(mobileSheet, 'flex flex-1 flex-col gap-5')}>
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-20 w-2/3" />
      </div>
    </div>
  )
}

interface PurchasePanelProps {
  nft: NftDetail
  editionId: EditionId
  onEditionChange: (id: EditionId) => void
}

function usePurchase({ nft, editionId }: Pick<PurchasePanelProps, 'nft' | 'editionId'>) {
  const edition = nft.editions.find((item) => item.id === editionId) ?? nft.editions[0]
  const maxQuantity = edition.status === 'available' ? Math.min(edition.available, edition.maxPerOrder) : 0
  const [requested, setQuantity] = useState(1)
  // Disponibilidade pode mudar em tempo real: a quantidade efetiva é limitada ao novo máximo.
  const quantity = Math.max(1, Math.min(requested, maxQuantity || 1))
  return { edition, maxQuantity, quantity, setQuantity, purchasable: maxQuantity > 0 }
}

function EditionPicker({ nft, editionId, onEditionChange }: PurchasePanelProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-[15px] leading-4 font-bold md:mb-3">Edição:</legend>
      <div role="radiogroup" aria-label="Edição" className="flex flex-wrap gap-3 md:gap-1.5">
        {nft.editions.map((edition) => {
          const selected = edition.id === editionId
          const unavailable = edition.status !== 'available'
          const status = edition.status === 'sold_out' ? 'esgotada' : edition.status === 'unavailable' ? 'indisponível' : `${edition.available} disponíveis`
          return (
            <button
              key={edition.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Edição ${edition.label}, ${status}`}
              onClick={() => onEditionChange(edition.id)}
              className={cn(
                'h-7 min-w-[42px] rounded-full border px-1.5 text-sm transition-[color,border-color,scale] duration-300 ease-spring motion-safe:active:scale-90',
                selected ? 'border-primary font-medium text-highlight' : 'border-line text-sand hover:border-primary/70',
                unavailable && 'text-khaki line-through decoration-coral',
              )}
            >
              {edition.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function AvailabilityHint({ edition, maxQuantity }: { edition: NftDetail['editions'][number]; maxQuantity: number }) {
  if (edition.status === 'unavailable') return <p className="text-sm text-coral">Esta edição está indisponível para compra.</p>
  if (edition.status === 'sold_out') return <p className="text-sm text-coral">Edição esgotada. Escolha outra edição.</p>
  return (
    <p className="text-xs text-khaki">
      {edition.supply === null ? 'Edição aberta' : `${edition.available} de ${edition.supply} disponíveis`} · máximo de {maxQuantity} por pedido
    </p>
  )
}

export function NftDetailView({ nftId, editionId, onEditionChange }: { nftId: string; editionId: EditionId | undefined; onEditionChange: (id: EditionId) => void }) {
  const query = useNftDetail(nftId)
  useRealtimeTopic(`nft:${nftId}`)

  if (query.isPending) {
    return (
      <div className="container-page">
        <DetailSkeleton />
      </div>
    )
  }
  if (query.isError) {
    if (toApiError(query.error).status === 404) {
      return <NotFound title="NFT não encontrado" description="Este NFT não existe ou foi removido do catálogo." />
    }
    return (
      <div className="container-page py-16">
        <ErrorState error={query.error} title="Não foi possível carregar este NFT" onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </div>
    )
  }
  const nft = query.data
  const defaultEdition = nft.editions.find((item) => item.status === 'available' && item.id === '1-50')?.id ?? nft.editions.find((item) => item.status === 'available')?.id ?? nft.editions[0].id
  return <NftDetailContent nft={nft} editionId={editionId ?? defaultEdition} onEditionChange={onEditionChange} />
}

function NftDetailContent({ nft, editionId, onEditionChange }: PurchasePanelProps) {
  const navigate = useNavigate()
  const [activeImage, setActiveImage] = useState(0)
  const [imageChanged, setImageChanged] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  const favorites = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const addToCart = useAddToCart()
  const { edition, maxQuantity, quantity, setQuantity, purchasable } = usePurchase({ nft, editionId })
  const favorite = favorites.data?.has(nft.id) ?? false
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = `${nft.name} na Kurio`

  const add = (goToCart: boolean) =>
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity, name: nft.name },
      { onSuccess: () => goToCart && void navigate({ to: '/carrinho' }) },
    )

  const gallery = useMemo(() => nft.gallery.map((artwork, index) => ({ artwork, label: `Vista ${index + 1} de ${nft.gallery.length}` })), [nft.gallery])

  const favoriteButton = (
    <Button
      variant="outline"
      onClick={() => toggleFavorite.toggle(nft.id, !favorite, nft.name)}
      aria-pressed={favorite}
      className="h-10 w-[130px] gap-2 text-sm"
    >
      {favorite ? <Heart className="size-5" fill="currentColor" aria-hidden="true" /> : <HeartIcon className="size-5" />}
      Favoritar
    </Button>
  )

  return (
    <article className="container-page" aria-labelledby="nft-title">
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: nft.name }]} className="pt-8 pb-4" />

      <div className="flex flex-col md:flex-row md:gap-8 lg:gap-[33px]">
        {/* Galeria (no mobile, o "Hero" do frame: voltar, favoritar e a arte) */}
        <div className={cn(mobileHero, 'md:self-start')}>
          <MobileTopBar
            fallback="/mercado"
            className="pt-[23px] pb-2"
            action={
              <button
                type="button"
                onClick={() => toggleFavorite.toggle(nft.id, !favorite, nft.name)}
                aria-pressed={favorite}
                aria-label={`Favoritar ${nft.name}`}
                className="flex size-[35px] items-center justify-center rounded-full border border-line bg-raised text-highlight"
              >
                {favorite ? <Heart className="size-4" fill="currentColor" aria-hidden="true" /> : <HeartIcon className="size-4" />}
              </button>
            }
          />
          <div className="flex gap-7">
            <div className="hidden flex-col gap-4 lg:flex" role="group" aria-label="Miniaturas da galeria">
              {gallery.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setActiveImage(index)
                    setImageChanged(true)
                  }}
                  onPointerEnter={() => preloadArtwork(item.artwork, mainImageSizes)}
                  onFocus={() => preloadArtwork(item.artwork, mainImageSizes)}
                  aria-label={item.label}
                  aria-pressed={index === activeImage}
                  className={cn(
                    'group/thumb size-[100px] overflow-hidden rounded-lg border transition-[border-color,scale] duration-300 ease-out-expo motion-safe:active:scale-95',
                    index === activeImage ? 'border-primary' : 'border-transparent hover:border-primary/50',
                  )}
                >
                  <NftImage artwork={item.artwork} alt="" sizes="100px" className="transition-transform duration-500 ease-out-expo motion-safe:group-hover/thumb:scale-110" />
                </button>
              ))}
            </div>
            <div className="relative h-fit w-full md:w-[min(444px,42vw)] md:rounded-md md:bg-card md:p-4">
              {/* A arte inicial aparece sem animação (LCP); ao trocar pela galeria, a nova entra com fade. */}
              <div key={gallery[activeImage].artwork} className={cn(imageChanged && 'animate-scale-in')}>
                <NftImage
                  artwork={gallery[activeImage].artwork}
                  alt={`${nft.name}: ${nft.attributes.join(', ')}`}
                  sizes={mainImageSizes}
                  priority
                  className="aspect-[361/356] rounded-3xl md:aspect-square"
                />
              </div>
              {/* A arte inteira amplia; a lupa só aparece no frame desktop. */}
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                className="group absolute inset-0 cursor-zoom-in rounded-3xl md:rounded-md"
                aria-label="Ampliar imagem"
              >
                <span className="absolute top-3 right-3 hidden size-[30px] items-center justify-center rounded-full border border-line bg-raised text-foreground transition-[color,scale] duration-300 ease-spring group-hover:text-highlight motion-safe:group-hover:scale-115 md:flex">
                  <SearchIcon className="size-4" />
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Informações (no mobile, a "Details Sheet" do frame) */}
        <div className={cn(mobileSheet, 'stagger-children flex min-w-0 flex-1 flex-col gap-3 max-md:animate-sheet-up md:gap-5')}>
          <header className="flex items-center justify-between gap-3 md:flex-col md:items-stretch md:justify-start md:border-b md:border-primary/30 md:pb-3">
            <h1 id="nft-title" className="text-xl leading-6 font-bold md:text-[28px] md:leading-9">
              {nft.name}
            </h1>
            <RatingPill rating={nft.rating} reviewsCount={nft.reviewsCount} className="md:hidden" />
            <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
              <PriceWithCompare price={nft.price} compareAtPrice={nft.compareAtPrice} className="text-[22px] leading-5" />
              <p className="flex items-center gap-2 text-[15px]">
                <Stars rating={nft.rating} />
                <span>
                  <span className="sr-only">Nota {nft.rating.toFixed(1)} de 5, </span>
                  {nft.reviewsCount} avaliações de colecionadores
                </span>
              </p>
            </div>
          </header>

          <section aria-labelledby="about-title" className="flex flex-col gap-3">
            <h2 id="about-title" className="text-[15px] leading-4 font-bold max-md:sr-only">
              Sobre este NFT:
            </h2>
            <p className="text-sm leading-6 text-sand">{nft.description}</p>
          </section>

          <EditionPicker nft={nft} editionId={edition.id} onEditionChange={onEditionChange} />

          <div className="hidden flex-col gap-2 md:flex">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <QuantityStepper value={quantity} max={Math.max(1, maxQuantity)} onChange={setQuantity} label={nft.name} disabled={!purchasable} />
              <div className="flex gap-2">
                <Button onClick={() => add(true)} disabled={!purchasable || addToCart.isPending} className="h-10 w-[130px] text-sm">
                  {addToCart.isPending ? 'Adicionando…' : 'COMPRAR'}
                </Button>
                {favoriteButton}
              </div>
            </div>
            <AvailabilityHint edition={edition} maxQuantity={maxQuantity} />
          </div>

          <dl className="flex flex-col gap-3 text-[15px] leading-5 text-khaki">
            <div className="flex gap-[1ch]">
              <dt>ID do token:</dt>
              <dd>{nft.tokenId}</dd>
            </div>
            <div className="flex gap-[1ch]">
              <dt>Coleção:</dt>
              <dd>{nft.collectionName}</dd>
            </div>
            <div className="flex gap-[1ch]">
              <dt>Atributos:</dt>
              <dd>{nft.attributes.join(', ')}</dd>
            </div>
          </dl>

          <div className="hidden items-center gap-2 text-[15px] font-bold md:flex">
            <span>Compartilhar este NFT:</span>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Compartilhar no LinkedIn (abre em nova aba)"
              className="flex size-8 items-center justify-center hover:text-highlight"
            >
              <LinkedinIcon className="h-[14px] w-[15px]" />
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`}
              aria-label="Compartilhar por e-mail"
              className="flex size-8 items-center justify-center hover:text-highlight"
            >
              <MessageIcon className="size-[18px]" />
            </a>
            <a
              href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Compartilhar no X (abre em nova aba)"
              className="flex size-8 items-center justify-center hover:text-highlight"
            >
              <TwitterIcon className="h-3 w-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Barra de compra do frame "Mobile / Detalhes do NFT" (a navegação inferior não aparece nesta tela) */}
      <div
        data-testid="purchase-bar"
        className="fixed inset-x-0 bottom-0 z-30 animate-in rounded-t-[40px] bg-card px-6 pt-5 pb-[calc(36px+env(safe-area-inset-bottom))] shadow-[0_0_20px_rgb(10_6_4/0.45)] duration-700 ease-sheet slide-in-from-bottom md:hidden"
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[15px] leading-4 font-medium text-sand">
              Qtd.
              <QuantityStepper size="sm" value={quantity} max={Math.max(1, maxQuantity)} onChange={setQuantity} label={nft.name} disabled={!purchasable} />
            </span>
            <span className="flex items-baseline gap-2">
              {nft.compareAtPrice && (
                <s className="text-sm text-khaki">
                  <span className="sr-only">Preço anterior: </span>
                  <EthPrice value={mulEth(nft.compareAtPrice, quantity)} />
                </s>
              )}
              <EthPrice value={mulEth(nft.price, quantity)} className="text-xl leading-4 font-bold text-highlight" />
            </span>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => add(true)}
              disabled={!purchasable || addToCart.isPending}
              className="h-[60px] w-[196px] rounded-[40px] bg-transparent bg-linear-108 from-primary to-primary/80 text-base leading-5"
            >
              Comprar NFT
            </Button>
            <Button
              variant="secondary"
              onClick={() => add(false)}
              disabled={!purchasable || addToCart.isPending}
              className="size-[60px] rounded-full border border-line text-khaki"
              aria-label={`Adicionar ${nft.name} ao carrinho`}
            >
              <ShopIcon className="size-5" />
            </Button>
          </div>
          {!purchasable && <AvailabilityHint edition={edition} maxQuantity={maxQuantity} />}
        </div>
      </div>

      <Tabs defaultValue="detalhes" className="mt-16 md:mt-24">
        <TabsList className="h-auto w-full items-end group-data-[orientation=horizontal]/tabs:h-auto justify-start gap-4 rounded-none border-b border-primary/30 bg-transparent p-0 md:gap-8">
          <TabsTrigger
            value="detalhes"
            className="h-auto flex-initial rounded-none border-0 border-b-[3px] border-transparent bg-transparent px-0 pb-3 text-left text-[15px] leading-5 whitespace-normal md:text-[17px] md:leading-4 font-normal text-foreground shadow-none hover:text-highlight data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-highlight data-[state=active]:shadow-none"
          >
            Detalhes do NFT
          </TabsTrigger>
          <TabsTrigger
            value="avaliacoes"
            className="h-auto flex-initial rounded-none border-0 border-b-[3px] border-transparent bg-transparent px-0 pb-3 text-left text-[15px] leading-5 whitespace-normal md:text-[17px] md:leading-4 font-normal text-foreground shadow-none hover:text-highlight data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-highlight data-[state=active]:shadow-none"
          >
            Avaliações de colecionadores ({nft.reviewsCount})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="detalhes" className="animate-fade-in pt-3 text-sm leading-6 text-sand">
          {nft.story.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="mb-6">
              {paragraph}
            </p>
          ))}
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="font-bold text-foreground">Rede:</dt>
              <dd>Cunhado na {networkLabels[nft.network]} com procedência imutável e metadados armazenados no IPFS.</dd>
            </div>
            <div>
              <dt className="font-bold text-foreground">Contrato:</dt>
              <dd>Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</dd>
            </div>
            <div>
              <dt className="font-bold text-foreground">Direitos autorais:</dt>
              <dd>
                <span title={nft.contractAddress}>{shortAddress(nft.contractAddress)}</span> • Contrato inteligente ERC-721 verificado.
              </dd>
            </div>
          </dl>
        </TabsContent>
        <TabsContent value="avaliacoes" className="animate-fade-in pt-4">
          <p className="mb-4 flex items-center gap-2 text-sm">
            <Stars rating={nft.rating} /> {nft.rating.toFixed(1)} de 5 · {nft.reviewsCount} avaliações
          </p>
          <ul className="stagger-children grid gap-4 md:grid-cols-3">
            {nft.reviews.map((review) => (
              <li key={review.id} className="rounded-md bg-card p-4 transition-colors duration-300 hover:bg-raised">
                <p className="flex items-center justify-between gap-2 text-sm font-bold">
                  {review.author}
                  <span className="flex items-center gap-1 text-highlight">
                    <StarIcon className="size-3.5" aria-hidden="true" /> {review.rating}
                    <span className="sr-only"> de 5</span>
                  </span>
                </p>
                <p className="mt-2 text-sm leading-6 text-sand">{review.comment}</p>
                <p className="mt-2 text-xs text-khaki">{new Date(review.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <RelatedCarousel nft={nft} />

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[min(92vw,960px)] p-3 sm:max-w-[min(92vw,960px)]">
          <DialogTitle className="sr-only">{nft.name} ampliado</DialogTitle>
          <DialogDescription className="sr-only">Imagem em alta resolução</DialogDescription>
          <img src={artworkSrc(gallery[activeImage].artwork, 960)} alt={`${nft.name} em alta resolução`} width={960} height={960} className="h-auto w-full rounded-xl" />
        </DialogContent>
      </Dialog>
    </article>
  )
}
