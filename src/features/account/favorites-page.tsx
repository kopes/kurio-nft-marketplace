import { useQueries } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { EmptyState, ErrorState } from '@/components/common/states'
import { buttonVariants } from '@/components/ui/button'
import { nftDetailQuery } from '@/features/catalog/queries'
import { useFavorites, useToggleFavorite } from '@/features/favorites/queries'

export function FavoritesPage() {
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const ids = favorites.data ? [...favorites.data] : []
  const details = useQueries({ queries: ids.map((id) => nftDetailQuery(id)) })

  return (
    <section aria-labelledby="favorites-title" className="flex flex-col gap-6">
      <h1 id="favorites-title" className="text-lg leading-4 font-bold">
        Lista de interesse
      </h1>
      {favorites.isError ? (
        <ErrorState error={favorites.error} title="Não foi possível carregar seus favoritos" onRetry={() => void favorites.refetch()} />
      ) : favorites.isPending ? (
        <ul className="grid grid-cols-2 gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index}>
              <NftCardSkeleton />
            </li>
          ))}
        </ul>
      ) : ids.length === 0 ? (
        <EmptyState
          title="Nenhum favorito ainda"
          description="Toque no coração dos NFTs que você quer acompanhar."
          action={
            <Link to="/mercado" className={buttonVariants()}>
              Explorar o mercado
            </Link>
          }
        />
      ) : (
        <ul className="stagger-children grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3" aria-label={`${ids.length} NFTs favoritos`}>
          {ids.map((id, index) => {
            const detail = details[index]
            return (
              <li key={id}>
                {detail?.data ? (
                  <NftCard nft={detail.data} favorite onToggleFavorite={(nft) => toggle.toggle(nft.id, false, nft.name)} />
                ) : (
                  <NftCardSkeleton />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
