import { Link, type ErrorComponentProps } from '@tanstack/react-router'
import { ErrorState } from './states'

export function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="container-page py-16">
      <ErrorState error={error} title="Algo deu errado nesta página" onRetry={reset} />
      <p className="mt-6 text-center">
        <Link to="/" className="text-highlight underline-offset-4 hover:underline">
          Voltar para o início
        </Link>
      </p>
    </div>
  )
}
