import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { EthPrice } from '@/components/nft/price'
import { NftImage } from '@/components/nft/nft-image'
import { networkLabels, walletProviderLabels, type Quote, type WalletConnection } from '@/shared/contracts'
import { compareEth, formatEth, isZeroEth } from '@/shared/eth'
import { cn } from '@/lib/utils'
import type { CheckoutValues } from './checkout-form'
import { shortAddress } from './checkout-form'

export interface ReviewState {
  open: boolean
  /** Cotação que o usuário está revisando/confirmando. */
  reviewed: Quote | null
}

interface ReviewDialogProps {
  state: ReviewState
  latest: Quote | undefined
  values: CheckoutValues
  connection: WalletConnection | null
  submitting: boolean
  retryCount: number
  error: string | null
  onAcceptLatest: () => void
  onConfirm: () => void
  onClose: () => void
}

function changes(reviewed: Quote, latest: Quote) {
  const lines: string[] = []
  for (const item of latest.items) {
    const before = reviewed.items.find((candidate) => candidate.cartItemId === item.cartItemId)
    if (before && compareEth(before.unitPrice, item.unitPrice) !== 0) {
      lines.push(`${item.name}: ${formatEth(before.unitPrice)} → ${formatEth(item.unitPrice)} ETH`)
    }
  }
  for (const issue of latest.issues) if (issue.code !== 'PRICE_CHANGED') lines.push(issue.message)
  if (compareEth(reviewed.discount, latest.discount) !== 0) lines.push(`Desconto: ${formatEth(reviewed.discount)} → ${formatEth(latest.discount)} ETH`)
  if (compareEth(reviewed.networkFee, latest.networkFee) !== 0) lines.push(`Taxa de rede: ${formatEth(reviewed.networkFee)} → ${formatEth(latest.networkFee)} ETH`)
  if (reviewed.items.length !== latest.items.length) lines.push('Itens do carrinho foram alterados.')
  return lines
}

/**
 * Revisão antes do envio. Se a cotação mudar (evento em tempo real ou resposta 409 da API),
 * a confirmação fica bloqueada até o usuário aceitar explicitamente os novos valores.
 */
export function ReviewDialog({ state, latest, values, connection, submitting, retryCount, error, onAcceptLatest, onConfirm, onClose }: ReviewDialogProps) {
  const reviewed = state.reviewed
  const stale = Boolean(reviewed && latest && latest.id !== reviewed.id)
  const blocking = latest?.issues.some((issue) => issue.code !== 'PRICE_CHANGED') ?? false
  const diff = reviewed && latest && stale ? changes(reviewed, latest) : []
  const quote = reviewed

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="gap-5 border-b-[10px] border-b-primary sm:max-w-[620px]" aria-describedby="review-description">
        <DialogTitle className="text-xl">Revise seu pedido</DialogTitle>
        <DialogDescription id="review-description" className="text-sand">
          Confira os dados antes de confirmar. Os valores são calculados pela cotação da API.
        </DialogDescription>

        {stale && (
          <div role="alert" className="flex flex-col gap-2 rounded-sm border border-amber/70 bg-amber/10 p-4 text-sm" data-testid="quote-changed">
            <p className="font-bold text-amber">Os valores mudaram desde a sua revisão.</p>
            {diff.length > 0 && (
              <ul className="list-inside list-disc text-foreground">
                {diff.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <p className="text-sand">
              Novo total: <strong className="text-highlight">{latest ? `${formatEth(latest.total)} ETH` : '—'}</strong>. Confirme novamente para continuar.
            </p>
            {!blocking && (
              <Button size="sm" variant="outline" className="w-fit" onClick={onAcceptLatest}>
                Revisar novos valores
              </Button>
            )}
            {blocking && <p className="text-coral">Alguns itens estão indisponíveis. Volte ao carrinho para ajustá-los.</p>}
          </div>
        )}

        {quote && (
          <>
            <ul className="flex flex-col gap-3" aria-label="Itens do pedido">
              {quote.items.map((item) => (
                <li key={item.cartItemId} className="flex items-center gap-3">
                  <NftImage artwork={item.artwork} alt="" sizes="48px" className="size-12 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{item.name}</p>
                    <p className="text-xs text-khaki">
                      Edição {item.editionLabel} · {item.quantity} × {formatEth(item.unitPrice)} ETH
                    </p>
                  </div>
                  <EthPrice value={item.lineTotal} className="text-sm font-bold text-highlight" />
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-y-2 border-t border-primary/30 pt-4 text-sm">
              <dt>Subtotal</dt>
              <dd className="text-right">
                <EthPrice value={quote.subtotal} />
              </dd>
              <dt>Desconto{quote.coupon ? ` (${quote.coupon.code})` : ''}</dt>
              <dd className="text-right">(-) {isZeroEth(quote.discount) ? '00.00' : `${formatEth(quote.discount)} ETH`}</dd>
              <dt>Taxa de rede ({networkLabels[quote.network]})</dt>
              <dd className="text-right">
                <EthPrice value={quote.networkFee} />
              </dd>
              <dt className="text-base font-bold">Total</dt>
              <dd className="text-right text-base font-bold text-highlight">
                <EthPrice value={quote.total} />
              </dd>
            </dl>
          </>
        )}

        <dl className="grid gap-x-4 gap-y-1 rounded-sm bg-raised p-4 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-khaki">Colecionador</dt>
          <dd>
            {values.displayName} (@{values.username}) · {values.email}
          </dd>
          <dt className="text-khaki">Carteira</dt>
          <dd>
            {walletProviderLabels[values.walletProvider]} · <span className="font-mono">{shortAddress(values.walletAddress)}</span>
          </dd>
          <dt className="text-khaki">Rede</dt>
          <dd>{networkLabels[values.network]}</dd>
          <dt className="text-khaki">ENS</dt>
          <dd>{values.ensName}.eth</dd>
          <dt className="text-khaki">Conexão</dt>
          <dd className={cn(connection ? 'text-success-text' : 'text-coral')}>{connection ? 'Carteira conectada' : 'Carteira desconectada'}</dd>
        </dl>

        {error && (
          <p role="alert" className="rounded-sm border border-coral/60 bg-coral/10 px-3 py-2 text-sm text-coral">
            ⚠ {error}
          </p>
        )}
        {submitting && retryCount > 0 && (
          <p role="status" className="text-sm text-amber">
            A rede está lenta. Verificando seu pedido sem criar uma nova compra (tentativa {retryCount + 1})…
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Voltar e editar
          </Button>
          <Button onClick={onConfirm} disabled={submitting || stale || blocking || !connection || !quote} data-testid="confirm-order">
            {submitting ? 'Enviando pedido…' : 'Confirmar e pagar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
