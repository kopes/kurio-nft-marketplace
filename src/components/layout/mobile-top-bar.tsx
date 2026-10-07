import { useCanGoBack, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ArrowLeft2Icon } from '@/components/icons'
import { cn } from '@/lib/utils'

/** Cabeçalho das telas mobile: voltar + título centralizado (frames de detalhe, carrinho e pagamento). */
export function MobileTopBar({ title, fallback = '/', action, className }: { title?: string; fallback?: string; action?: ReactNode; className?: string }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <div className={cn('flex items-center gap-4 pt-4 pb-3 md:hidden', className)}>
      <button
        type="button"
        onClick={() => (canGoBack ? router.history.back() : void router.navigate({ to: fallback }))}
        className="flex size-[35px] shrink-0 items-center justify-center rounded-full border border-line bg-raised text-sand"
        aria-label="Voltar"
      >
        <ArrowLeft2Icon className="size-5" />
      </button>
      {title ? <h1 className="flex-1 text-center text-lg font-bold">{title}</h1> : <span className="flex-1" />}
      <div className="flex min-w-[35px] justify-end">{action}</div>
    </div>
  )
}
