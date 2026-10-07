import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@/components/ui/button'

export function NotFound({ title = 'Página não encontrada', description = 'O endereço acessado não existe ou foi removido.' }: { title?: string; description?: string }) {
  return (
    <section className="container-page stagger-children flex flex-col items-center gap-4 py-24 text-center" aria-labelledby="not-found-title">
      <p className="text-6xl font-bold text-primary" aria-hidden="true">
        404
      </p>
      <h1 id="not-found-title" className="text-2xl font-bold">
        {title}
      </h1>
      <p className="max-w-md text-sand">{description}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link to="/" className={buttonVariants()}>
          Ir para o início
        </Link>
        <Link to="/mercado" className={buttonVariants({ variant: 'outline' })}>
          Explorar o mercado
        </Link>
      </div>
    </section>
  )
}
