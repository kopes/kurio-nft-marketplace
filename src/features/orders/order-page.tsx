import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { CloseIcon, ThankYouIcon } from '@/components/icons'
import { NotFound } from '@/components/common/not-found'
import { ErrorState } from '@/components/common/states'
import { NftImage } from '@/components/nft/nft-image'
import { EthPrice } from '@/components/nft/price'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { networkLabels, walletProviderLabels, type Order } from '@/shared/contracts'
import { formatEth, isZeroEth } from '@/shared/eth'
import { toApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import { announce } from '@/lib/announcer'
import { cn } from '@/lib/utils'
import { clearCheckoutDraft, loadAttempt, saveAttempt } from '@/features/checkout/checkout-storage'
import { useRealtimeStatus } from '@/features/realtime/realtime-bridge'
import { cartScope } from '@/features/session/session-store'
import { useSession } from '@/features/session/use-session'
import { useOrder } from './queries'

export function shortHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`.toUpperCase().replace('0X', '0x')
}

const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** Formato do Figma: "29 Jul, 2026". */
function formatDate(iso: string) {
  const date = new Date(iso)
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]}, ${date.getFullYear()}`
}

function Shell({ children, onClose, labelledBy }: { children: React.ReactNode; onClose: () => void; labelledBy: string }) {
  return (
    <div className="flex justify-center bg-ink px-4 py-10 md:py-[86px]">
      <section aria-labelledby={labelledBy} className="relative w-full max-w-[578px] animate-scale-in border-b-[10px] border-b-primary bg-card">
        <button type="button" onClick={onClose} className="absolute top-3 right-3 flex size-9 items-center justify-center text-primary hover:bg-raised" aria-label="Fechar e voltar ao início">
          <CloseIcon className="size-[18px]" />
        </button>
        {children}
      </section>
    </div>
  )
}

function PendingView({ order }: { order: Order }) {
  const status = useRealtimeStatus()
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-14 text-center md:px-12" data-testid="order-pending">
      <span className="size-14 animate-spin rounded-full border-4 border-primary/25 border-t-primary motion-reduce:animate-none" aria-hidden="true" />
      <h1 id="order-title" className="text-xl font-bold">
        Aguardando confirmação na rede
      </h1>
      <p className="max-w-sm text-sm leading-6 text-sand">
        Seu pedido <strong className="text-foreground">{order.id}</strong> foi recebido e está pendente. Você pode fechar ou recarregar esta página: o status será recuperado sem criar outra compra.
      </p>
      <p className="text-xs text-khaki" role="status">
        Total: {formatEth(order.total)} ETH · Tempo real: {status === 'connected' ? 'conectado' : 'reconectando…'}
      </p>
    </div>
  )
}

function DeclinedView({ order }: { order: Order }) {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-14 text-center md:px-12" data-testid="order-declined">
      <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full border-2 border-coral text-2xl text-coral">
        !
      </span>
      <h1 id="order-title" className="text-xl font-bold">
        Pagamento recusado
      </h1>
      <p className="max-w-sm text-sm leading-6 text-sand">{order.declineReason ?? 'A rede recusou o pagamento.'}</p>
      <p className="text-sm text-sand">Seus itens continuam no carrinho. Nenhum valor foi cobrado.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/pagamento" className={buttonVariants()}>
          Tentar novamente
        </Link>
        <Link to="/carrinho" className={buttonVariants({ variant: 'outline' })}>
          Voltar ao carrinho
        </Link>
      </div>
    </div>
  )
}

function ReceiptView({ order }: { order: Order }) {
  const summary = [
    { label: 'ID da transação', value: order.transaction ? shortHash(order.transaction.hash) : '—', strong: true },
    { label: 'Data', value: formatDate(order.confirmedAt ?? order.createdAt) },
    { label: 'Total', value: `${formatEth(order.total)} ETH` },
    { label: 'Carteira', value: walletProviderLabels[order.wallet.provider], strong: true },
  ]
  return (
    <div data-testid="order-receipt">
      <header className="flex flex-col items-center gap-4 border-b border-primary px-6 pt-6 pb-5">
        <ThankYouIcon className="size-20 animate-pop-in stagger-2 text-primary" />
        <h1 id="order-title" className="text-center text-base font-bold text-sand">
          Seus NFTs agora estão na sua carteira
        </h1>
      </header>
      <dl className="grid grid-cols-2 gap-y-3 border-b border-primary px-6 py-3 sm:grid-cols-[auto_auto_auto_auto] sm:justify-between sm:divide-x sm:divide-primary sm:px-8">
        {summary.map((item) => (
          <div key={item.label} className="flex flex-col sm:px-4 sm:first:pl-0 sm:last:pr-0">
            <dt className={cn('text-sm whitespace-nowrap', item.strong ? 'font-bold text-sand' : 'text-sand')}>{item.label}</dt>
            <dd className="text-sm whitespace-nowrap text-sand">{item.value}</dd>
          </div>
        ))}
      </dl>
      <div className="px-6 pt-6 pb-8 md:px-11">
        <h2 className="text-[15px] font-bold">Detalhes da transação</h2>
        <table className="mt-3 w-full text-left">
          <caption className="sr-only">Itens comprados</caption>
          <thead>
            <tr className="border-b border-primary/30 text-base">
              <th scope="col" className="pb-2 font-bold">
                NFTs
              </th>
              <th scope="col" className="pb-2 text-center font-bold">
                Edições
              </th>
              <th scope="col" className="pb-2 text-right font-bold">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={`${item.nftId}-${item.editionId}`}>
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    <NftImage artwork={item.artwork} alt="" sizes="70px" className="size-[66px] rounded-md" />
                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="text-sm text-khaki">ID do token: {item.tokenId}</p>
                      <p className="text-xs text-khaki">Edição {item.editionLabel}</p>
                    </div>
                  </div>
                </td>
                <td className="text-center text-sm text-sand">(x {item.quantity})</td>
                <td className="text-right">
                  <EthPrice value={item.lineTotal} className="font-bold text-highlight" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 ml-auto grid max-w-[320px] grid-cols-2 gap-y-1 border-b border-primary/30 pb-2 text-[15px]">
          {!isZeroEth(order.discount) && (
            <>
              <dt>Desconto{order.couponCode ? ` (${order.couponCode})` : ''}</dt>
              <dd className="text-right">(-) {formatEth(order.discount)} ETH</dd>
            </>
          )}
          <dt>Taxa de rede</dt>
          <dd className="text-right">
            <EthPrice value={order.networkFee} />
          </dd>
          <dt className="font-bold">Total</dt>
          <dd className="text-right font-bold text-highlight">
            <EthPrice value={order.total} />
          </dd>
        </dl>
        <p className="mt-4 text-center text-sm leading-[22px] text-sand">
          Transação confirmada na {networkLabels[order.network]}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
        </p>
        <div className="mt-5 flex justify-center">
          <Link to="/pedido/$orderId/transacao" params={{ orderId: order.id }} className={cn(buttonVariants(), 'h-12 px-4 text-base')}>
            Ver no Etherscan
          </Link>
        </div>
      </div>
    </div>
  )
}

export function OrderPage({ orderId }: { orderId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = useSession()?.user.id
  const order = useOrder(orderId)
  const announced = useRef<string | null>(null)
  const status = order.data?.status

  // Estados terminais: confirmação remove só os itens comprados (feito pela API); limpa a tentativa local.
  useEffect(() => {
    if (!userId || !status || status === 'pending' || announced.current === status) return
    announced.current = status
    const attempt = loadAttempt(userId)
    if (attempt?.orderId === orderId) saveAttempt(userId, null)
    if (status === 'confirmed') {
      clearCheckoutDraft(userId)
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart.scope(cartScope()) })
      announce('Pagamento confirmado. Seus NFTs agora estão na sua carteira.', 'assertive')
    } else {
      announce('Pagamento recusado. Seus itens continuam no carrinho.', 'assertive')
    }
  }, [status, userId, orderId, queryClient])

  if (order.isError) {
    const apiError = toApiError(order.error)
    if (apiError.status === 404 || apiError.status === 403) {
      return <NotFound title="Pedido não encontrado" description="Este pedido não existe ou não pertence à sua conta." />
    }
    return (
      <div className="container-page py-16">
        <ErrorState error={order.error} title="Não foi possível carregar o pedido" onRetry={() => void order.refetch()} />
      </div>
    )
  }

  return (
    <Shell onClose={() => void navigate({ to: '/' })} labelledBy="order-title">
      {!order.data ? (
        <div className="flex flex-col items-center gap-4 px-6 py-12" aria-busy="true">
          <h1 id="order-title" className="sr-only">
            Carregando pedido
          </h1>
          <Skeleton className="size-20 rounded-full" />
          <Skeleton className="h-5 w-72" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : order.data.status === 'pending' ? (
        <PendingView order={order.data} />
      ) : order.data.status === 'declined' ? (
        <DeclinedView order={order.data} />
      ) : (
        <ReceiptView order={order.data} />
      )}
    </Shell>
  )
}
