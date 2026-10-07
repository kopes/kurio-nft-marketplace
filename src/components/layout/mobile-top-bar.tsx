import { useCanGoBack, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ArrowLeft2Icon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface MobileTopBarProps {
  title?: string
  fallback?: string
  action?: ReactNode
  /** `start`: título logo após o Voltar, sem a coluna de equilíbrio à direita (frame de pagamento). */
  align?: 'center' | 'start'
  className?: string
  titleClassName?: string
  backClassName?: string
}

/** Cabeçalho das telas mobile: voltar + título (centralizado nos frames de detalhe e carrinho; à esquerda no pagamento). */
export function MobileTopBar({ title, fallback = '/', action, align = 'center', className, titleClassName, backClassName }: MobileTopBarProps) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <div className={cn('flex items-center gap-4 pt-4 pb-3 md:hidden', className)}>
      <button
        type="button"
        onClick={() => (canGoBack ? router.history.back() : void router.navigate({ to: fallback }))}
        className={cn('flex size-[35px] shrink-0 items-center justify-center rounded-full border border-line bg-raised text-sand', backClassName)}
        aria-label="Voltar"
      >
        <ArrowLeft2Icon className="size-5" />
      </button>
      {title ? <h1 className={cn('flex-1 text-lg font-bold', align === 'center' && 'text-center', titleClassName)}>{title}</h1> : <span className="flex-1" />}
      {(align === 'center' || action) && <div className="flex min-w-[35px] justify-end">{action}</div>}
    </div>
  )
}
