import { formatEth } from '@/shared/eth'
import { cartNotices, useCartNotices } from './cart-notices'

/** Alterações recebidas via Socket.IO para itens do carrinho (preço/disponibilidade). */
export function CartNoticesList() {
  const notices = useCartNotices()
  if (!notices.length) return null
  return (
    <ul className="flex flex-col gap-2" aria-label="Alterações recentes nos itens do carrinho">
      {notices.map((notice) => (
        <li key={notice.id} className="flex items-start justify-between gap-4 rounded-sm border border-amber/60 bg-amber/10 px-4 py-3 text-sm" data-testid="cart-notice">
          <p>
            <strong className="text-amber">Atualização em tempo real:</strong>{' '}
            {notice.kind === 'price'
              ? `o preço de ${notice.name} mudou de ${formatEth(notice.previousPrice)} para ${formatEth(notice.price)} ETH.`
              : `a disponibilidade de ${notice.name} mudou (${notice.available} unidade(s) disponíveis).`}{' '}
            O resumo foi recalculado.
          </p>
          <button type="button" onClick={() => cartNotices.dismiss(notice.id)} className="shrink-0 text-xs text-khaki hover:text-highlight" aria-label={`Dispensar aviso sobre ${notice.name}`}>
            Dispensar
          </button>
        </li>
      ))}
    </ul>
  )
}
