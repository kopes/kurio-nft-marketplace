import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { buttonVariants } from '@/components/ui/button'

const sections: Record<string, string> = {
  criadores: 'Criadores',
  aprenda: 'Aprenda',
  diario: 'Diário da Cunhagem',
  atividade: 'Atividade',
  colecao: 'Minha coleção',
  estudio: 'Estúdio do criador',
  suporte: 'Central de ajuda',
  ofertas: 'Ofertas',
  downloads: 'Arquivos baixados',
}

export const Route = createFileRoute('/em-breve')({
  validateSearch: z.object({ secao: z.string().max(30).optional().catch(undefined) }),
  head: () => ({ meta: [{ title: 'Em breve — Kurio' }, { name: 'robots', content: 'noindex' }] }),
  component: ComingSoon,
})

/** Páginas editoriais e de suporte estão fora do escopo: a tela informa isso sem simular funcionalidade. */
function ComingSoon() {
  const { secao } = Route.useSearch()
  const label = (secao && sections[secao]) || 'Esta seção'
  return (
    <section className="container-page stagger-children flex flex-col items-center gap-4 py-24 text-center" aria-labelledby="soon-title">
      <p className="text-sm font-bold tracking-[0.2em] text-highlight">EM BREVE</p>
      <h1 id="soon-title" className="text-2xl font-bold md:text-[28px]">
        {label} ainda não está disponível
      </h1>
      <p className="max-w-lg text-sand">Este conteúdo não faz parte desta versão do marketplace. Enquanto isso, explore o catálogo e as coleções disponíveis.</p>
      <Link to="/mercado" className={buttonVariants()}>
        Explorar o mercado
      </Link>
    </section>
  )
}
