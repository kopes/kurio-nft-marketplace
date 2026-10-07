import { createFileRoute, Link } from '@tanstack/react-router'
import { ErrorState } from '@/components/common/states'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { networkLabels } from '@/shared/contracts'
import { formatEth } from '@/shared/eth'
import { useOrder } from '@/features/orders/queries'

export const Route = createFileRoute('/_auth/pedido/$orderId_/transacao')({
  head: () => ({ meta: [{ title: 'Transação simulada — Kurio' }, { name: 'robots', content: 'noindex' }] }),
  component: ExplorerPage,
})

/** Explorador de blocos simulado: links de exploração não apontam para redes reais. */
function ExplorerPage() {
  const { orderId } = Route.useParams()
  const order = useOrder(orderId)
  return (
    <section className="container-page py-12" aria-labelledby="explorer-title">
      <p className="text-sm font-bold tracking-[0.2em] text-highlight">EXPLORADOR SIMULADO</p>
      <h1 id="explorer-title" className="mt-2 text-2xl font-bold">
        Detalhes da transação
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-sand">Esta é uma representação simulada do explorador de blocos. Nenhuma transação real foi enviada à rede.</p>
      {order.isError ? (
        <ErrorState error={order.error} className="mt-8" onRetry={() => void order.refetch()} />
      ) : !order.data ? (
        <Skeleton className="mt-8 h-56 w-full" />
      ) : (
        <dl className="mt-8 grid gap-x-8 gap-y-4 rounded-md bg-card p-6 text-sm sm:grid-cols-[200px_1fr]">
          <dt className="text-khaki">Hash da transação</dt>
          <dd className="font-mono break-all">{order.data.transaction?.hash ?? 'Ainda não disponível'}</dd>
          <dt className="text-khaki">Status</dt>
          <dd>{order.data.status === 'confirmed' ? 'Sucesso' : order.data.status === 'pending' ? 'Pendente' : 'Recusada'}</dd>
          <dt className="text-khaki">Bloco</dt>
          <dd>{order.data.transaction?.blockNumber?.toLocaleString('pt-BR') ?? '—'}</dd>
          <dt className="text-khaki">Rede</dt>
          <dd>{networkLabels[order.data.network]}</dd>
          <dt className="text-khaki">Carteira de destino</dt>
          <dd className="font-mono break-all">{order.data.wallet.address}</dd>
          <dt className="text-khaki">Valor</dt>
          <dd>{formatEth(order.data.total)} ETH</dd>
        </dl>
      )}
      <Link to="/pedido/$orderId" params={{ orderId }} className={`${buttonVariants({ variant: 'outline' })} mt-8`}>
        Voltar ao recibo
      </Link>
    </section>
  )
}
