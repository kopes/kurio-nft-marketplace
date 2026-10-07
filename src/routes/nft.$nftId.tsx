import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { EditionId } from '@/shared/contracts'
import { nftDetailQuery } from '@/features/catalog/queries'
import { NftDetailView } from '@/features/nft/nft-detail'

export const Route = createFileRoute('/nft/$nftId')({
  validateSearch: z.object({ edicao: EditionId.optional().catch(undefined) }),
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftDetailQuery(params.nftId))
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.nftId.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())} — Kurio` },
      { name: 'description', content: 'Detalhes, edições e procedência do NFT no marketplace Kurio.' },
    ],
  }),
  component: NftPage,
})

function NftPage() {
  const { nftId } = Route.useParams()
  const { edicao } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <NftDetailView
      key={nftId}
      nftId={nftId}
      editionId={edicao}
      onEditionChange={(id) => void navigate({ search: { edicao: id }, replace: true, resetScroll: false })}
    />
  )
}
