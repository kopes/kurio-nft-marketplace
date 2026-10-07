import type { ReactNode } from 'react'
import { DangerIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { toApiError } from '@/api/errors'
import { cn } from '@/lib/utils'

export function ErrorState({
  error,
  title = 'Não foi possível carregar',
  onRetry,
  retrying = false,
  className,
}: {
  error: unknown
  title?: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  const apiError = toApiError(error)
  return (
    <div role="alert" className={cn('flex animate-fade-up flex-col items-center gap-3 rounded-md bg-card px-6 py-10 text-center', className)}>
      <DangerIcon className="size-8 text-coral" />
      <p className="text-lg font-bold">{title}</p>
      <p className="max-w-md text-sm text-sand">{apiError.message}</p>
      {apiError.status && <p className="text-xs text-khaki">Código: {apiError.status} · {apiError.code}</p>}
      {onRetry && (
        <Button onClick={onRetry} disabled={retrying} className="mt-2">
          {retrying ? 'Tentando novamente…' : 'Tentar novamente'}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, description, action, className }: { title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div role="status" className={cn('flex animate-fade-up flex-col items-center gap-3 rounded-md bg-card px-6 py-12 text-center', className)}>
      <p className="text-lg font-bold">{title}</p>
      {description && <p className="max-w-md text-sm text-sand">{description}</p>}
      {action}
    </div>
  )
}

/** Indicador discreto de atualização em segundo plano (refetch com dados já exibidos). */
export function BackgroundRefresh({ active, label = 'Atualizando…' }: { active: boolean; label?: string }) {
  return (
    <span role="status" aria-live="polite" className={cn('text-xs text-khaki transition-opacity', active ? 'opacity-100' : 'opacity-0')}>
      {active ? label : ''}
    </span>
  )
}

/**
 * Carregamento de rota (código da página sob demanda; o router já espera 200 ms): o mesmo anel do app shell, cujas classes
 * `.app-loader*` estão definidas inline no index.html. Ocupa a área da página para o rodapé não subir.
 */
export function PagePending() {
  return (
    <div role="status" className="grid min-h-[60vh] place-items-center">
      <span className="app-loader__ring" />
      <span className="sr-only">Carregando…</span>
    </div>
  )
}
