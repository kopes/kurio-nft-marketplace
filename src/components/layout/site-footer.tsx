import { Link, useRouterState } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from '@/components/icons'
import { collectionLabels, type CollectionId } from '@/shared/contracts'
import { cn } from '@/lib/utils'

const services = [
  { mark: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { mark: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { mark: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const socials = [
  { label: 'Facebook', href: 'https://www.facebook.com/', Icon: FacebookIcon, className: 'h-4 w-2' },
  { label: 'Instagram', href: 'https://www.instagram.com/', Icon: InstagramIcon, className: 'size-4' },
  { label: 'X (Twitter)', href: 'https://x.com/', Icon: TwitterIcon, className: 'h-[13px] w-4' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/', Icon: LinkedinIcon, className: 'h-[15px] w-4' },
  { label: 'YouTube', href: 'https://www.youtube.com/', Icon: YoutubeIcon, className: 'h-[14px] w-[19px]' },
]

const footerCollections: CollectionId[] = ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'utilidade']

export function WalletBrandsBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border border-[#55321F] bg-deep px-2 py-1.5 text-[9px] leading-3 font-bold tracking-[0.01em] whitespace-nowrap text-highlight', className)}>
      METAMASK&nbsp;&nbsp;•&nbsp;&nbsp;WALLETCONNECT&nbsp;&nbsp;•&nbsp;&nbsp;COINBASE
    </span>
  )
}

function Newsletter() {
  const [message, setMessage] = useState<string | null>(null)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // Fora do escopo: não simulamos sucesso de uma ação que não existe na API.
    setMessage('A inscrição em novidades não está disponível nesta demonstração.')
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-labelledby="newsletter-title">
      <h2 id="newsletter-title" className="text-lg leading-4 font-bold">
        Antecipe-se ao próximo lançamento
      </h2>
      <div className="flex h-10 overflow-hidden rounded-md bg-deep shadow-md">
        <label htmlFor="newsletter-email" className="sr-only">
          E-mail para novidades
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          placeholder="digite seu e-mail..."
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"
        />
        <button type="submit" className="bg-primary px-4 text-lg font-bold text-ink hover:bg-highlight">
          Enviar
        </button>
      </div>
      <p role="status" className="text-[13px] leading-[22px] text-sand">
        {message ?? 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.'}
      </p>
    </form>
  )
}

/**
 * Espaço inferior no mobile para elementos fixos: barra de abas (126 px com o botão central)
 * ou barra de compra do detalhe (~166 px + safe area). Telas sem barra fixa não precisam de reserva.
 * Carrinho e pagamento ocupam exatamente a tela no mobile (como nos frames): sem rodapé nem rolagem abaixo da ação.
 */
function mobileBottomSpace(pathname: string) {
  if (pathname.startsWith('/nft/')) return 'pb-[calc(184px+env(safe-area-inset-bottom))]'
  if (/^\/(carrinho|pagamento)/.test(pathname)) return 'max-md:hidden'
  if (/^\/(entrar|cadastro)/.test(pathname)) return 'pb-6'
  return 'pb-36'
}

export function SiteFooter() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return (
    <footer className={cn('container-page mt-24 md:pb-6', mobileBottomSpace(pathname))}>
      <section aria-label="Serviços Kurio" className="grid gap-8 bg-card p-6 md:p-8 lg:grid-cols-[1fr_1fr_1fr_1.35fr] lg:gap-0">
        {services.map((service) => (
          <div key={service.mark} className="group flex flex-col gap-3 lg:border-r lg:border-primary lg:px-4">
            <span
              aria-hidden="true"
              className="flex size-[74px] items-center justify-center rounded-full bg-primary text-2xl font-bold text-ink transition-[scale,box-shadow] duration-500 ease-spring group-hover:shadow-[0_0_0_8px_rgb(210_138_76/0.15)] motion-safe:group-hover:scale-105"
            >
              {service.mark}
            </span>
            <h2 className="text-[17px] leading-4 font-bold">{service.title}</h2>
            <p className="max-w-[204px] text-sm leading-[22px] text-sand">{service.text}</p>
          </div>
        ))}
        <div className="lg:px-4">
          <Newsletter />
        </div>
      </section>

      <div className="grid gap-4 bg-deep px-6 py-6 text-sm leading-[22px] sm:grid-cols-2 md:px-8 lg:grid-cols-4">
        <span className="text-sm font-bold tracking-[0.1em]">KURIO</span>
        <p>
          Feito para colecionadores,
          <br /> criadores e cultura
        </p>
        <a href="mailto:contato@email.com" className="hover:text-highlight">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="hover:text-highlight">
          +55 11 4002 8922
        </a>
      </div>

      <div className="grid gap-10 bg-card px-6 py-8 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
        <nav aria-labelledby="footer-profile">
          <h2 id="footer-profile" className="mb-2 text-lg font-bold">
            Meu perfil
          </h2>
          <ul className="text-sm leading-[30px]">
            <li>
              <Link to="/perfil" className="hover:text-highlight">
                Meu perfil
              </Link>
            </li>
            <li>
              <Link to="/em-breve" search={{ secao: 'colecao' }} className="hover:text-highlight">
                Minha coleção
              </Link>
            </li>
            <li>
              <Link to="/em-breve" search={{ secao: 'atividade' }} className="hover:text-highlight">
                Atividade
              </Link>
            </li>
            <li>
              <Link to="/em-breve" search={{ secao: 'estudio' }} className="hover:text-highlight">
                Estúdio do criador
              </Link>
            </li>
            <li>
              <Link to="/perfil/favoritos" className="hover:text-highlight">
                Lista de interesse
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-help">
          <h2 id="footer-help" className="mb-2 text-lg font-bold">
            Central de ajuda
          </h2>
          <ul className="text-sm leading-[30px]">
            {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map((label) => (
              <li key={label}>
                <Link to="/em-breve" search={{ secao: 'suporte' }} className="hover:text-highlight">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-collections">
          <h2 id="footer-collections" className="mb-2 text-lg font-bold">
            Coleções
          </h2>
          <ul className="text-sm leading-[30px]">
            {footerCollections.map((id) => (
              <li key={id}>
                <Link to="/mercado" search={{ colecoes: id }} className="hover:text-highlight">
                  {collectionLabels[id]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="mb-5 text-lg leading-4 font-bold">Redes sociais</h2>
            <ul className="flex gap-2.5">
              {socials.map(({ label, href, Icon, className }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} (abre em nova aba)`}
                    className="flex size-[30px] items-center justify-center rounded-sm border border-primary text-primary transition-[color,background-color,translate] duration-300 ease-out-expo hover:bg-primary hover:text-ink motion-safe:hover:-translate-y-0.5"
                  >
                    <Icon className={className} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-lg leading-4 font-bold">Carteiras compatíveis</h2>
            <WalletBrandsBadge />
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-center text-sm leading-[30px]">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
