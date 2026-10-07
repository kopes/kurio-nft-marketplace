import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowRightIcon } from '@/components/icons'
import { NftImage, preloadArtwork } from '@/components/nft/nft-image'
import { buttonVariants } from '@/components/ui/button'
import type { ArtworkId } from '@/shared/contracts'
import { cn } from '@/lib/utils'

const slides: Array<{ artwork: ArtworkId; nftId: string; alt: string }> = [
  { artwork: 'emerald', nftId: 'emerald-ape-042', alt: 'Emerald Ape #042: macaco de óculos redondos e jaqueta college verde' },
  { artwork: 'golden', nftId: 'golden-beat-207', alt: 'Golden Beat #207: macaco dourado com fones de ouvido verdes' },
  { artwork: 'ivory', nftId: 'ivory-baron-088', alt: 'Ivory Baron #088: gorila de blazer marfim e gola alta verde' },
]

const heroSizes = '(min-width: 768px) 450px, 140px'

/**
 * Hero: o texto entra em cascata e a arte flutua devagar. A primeira arte não tem animação de entrada (é o LCP no desktop);
 * as seguintes entram com um leve zoom e já vêm pré-carregadas ao passar o mouse ou focar o ponto do carrossel.
 */
export function Hero() {
  const [active, setActive] = useState(0)
  const [changed, setChanged] = useState(false)
  const slide = slides[active]
  const select = (index: number) => {
    setActive(index)
    setChanged(true)
  }
  return (
    <section aria-labelledby="hero-title" className="container-page max-md:px-6">
      {/* Desktop/tablet */}
      <div className="hidden items-center gap-10 pt-8 md:flex lg:gap-[110px] lg:pl-10">
        <div className="flex min-w-0 flex-1 flex-col gap-11">
          <div className="flex flex-col gap-1">
            <p className="animate-fade-up text-sm leading-4 font-medium tracking-[0.1em]">Bem-vindo à Kurio</p>
            <h1 id="hero-title" className="mt-2 animate-fade-up stagger-1 text-[34px] leading-[56px] font-bold lg:text-[43px] lg:leading-[70px]">
              SEJA DONO DO FUTURO
              <br />
              DA ARTE DIGITAL
            </h1>
            <p className="max-w-[557px] animate-fade-up stagger-2 text-sm leading-6 text-sand">
              Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
            </p>
          </div>
          <div className="flex animate-fade-up stagger-3 items-end justify-between">
            <a href="#catalogo" className={cn(buttonVariants(), 'h-10 w-fit px-7 text-base')}>
              EXPLORAR
            </a>
            <div role="group" aria-label="Destaques do carrossel" className="flex gap-2">
              {slides.map((item, index) => (
                <button
                  key={item.artwork}
                  type="button"
                  onClick={() => select(index)}
                  onPointerEnter={() => preloadArtwork(item.artwork, heroSizes)}
                  onFocus={() => preloadArtwork(item.artwork, heroSizes)}
                  aria-label={`Mostrar destaque ${index + 1} de ${slides.length}`}
                  aria-pressed={index === active}
                  className="group/dot flex size-6 items-center justify-center"
                >
                  <span
                    className={cn(
                      'size-2 rounded-full transition-[background-color,scale] duration-300 ease-spring',
                      index === active ? 'bg-primary' : 'bg-primary/45 group-hover/dot:scale-150 group-hover/dot:bg-primary/70',
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="w-[min(450px,45%)] shrink-0 motion-safe:animate-float">
          <Link
            to="/nft/$nftId"
            params={{ nftId: slide.nftId }}
            className="group block overflow-hidden rounded-3xl transition-shadow duration-700 hover:shadow-[0_30px_60px_-28px_rgb(232_155_85/0.45)]"
            aria-label={`Ver ${slide.alt.split(':')[0]}`}
          >
            <div key={slide.artwork} className={cn('overflow-hidden rounded-3xl', changed && 'animate-scale-in')}>
              <NftImage
                artwork={slide.artwork}
                alt={slide.alt}
                sizes={heroSizes}
                priority={active === 0}
                className="aspect-square rounded-3xl transition-transform duration-700 ease-out-expo motion-safe:group-hover:scale-[1.04]"
              />
            </div>
          </Link>
        </div>
      </div>

      {/* Mobile (frame "Mobile / Início", nó "Hero Banner" 366×190) */}
      <div className="relative mt-4 h-[190px] overflow-hidden rounded-[30px] bg-[linear-gradient(116.9deg,rgb(210_138_76/0.2),rgb(210_138_76/0.1))] md:hidden">
        {/* Os círculos do Figma "respiram" devagar, fora de fase (decorativos; parados com movimento reduzido). */}
        <span
          aria-hidden="true"
          className="absolute -top-[31px] -left-20 size-[248px] rounded-full bg-[linear-gradient(160.25deg,rgb(221_154_95/0.43)_22%,rgb(210_138_76/0.04)_87%)] motion-safe:animate-drift"
        />
        <span
          aria-hidden="true"
          className="absolute -top-2.5 left-[73px] size-[248px] rounded-full bg-[linear-gradient(160.25deg,rgb(221_154_95/0.37)_22%,rgb(210_138_76/0)_87%)] motion-safe:animate-drift motion-safe:[animation-delay:-8s]"
        />
        <div className="relative flex h-full gap-2 px-4 pt-[5px]">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-col gap-1.5">
              <p className="animate-fade-up text-xs leading-4 font-medium">Bem-vindo à Kurio</p>
              <h1 className="animate-fade-up stagger-1 text-lg leading-[29px] font-bold">
                SEJA DONO DA
                <br />
                CULTURA DIGITAL
              </h1>
              <p className="animate-fade-up stagger-2 text-xs leading-[18px] text-sand">Descubra NFTs selecionados de criadores do mundo todo.</p>
            </div>
            <a href="#catalogo" className="group/cta flex w-fit animate-fade-up stagger-3 items-center gap-2 text-xs leading-4 font-bold text-highlight">
              EXPLORAR <ArrowRightIcon className="size-4 text-primary transition-transform duration-300 group-hover/cta:translate-x-1 group-active/cta:translate-x-1" />
            </a>
          </div>
          <div className="relative mt-1.5 h-[146px] w-[138px] shrink-0">
            <NftImage artwork="emerald" alt="Emerald Ape #042" sizes="138px" priority className="size-[138px] rounded-2xl" />
            <div className="absolute top-[88px] left-3.5 motion-safe:animate-float motion-safe:[animation-delay:-2s]">
              <NftImage artwork="sage" alt="" sizes="58px" className="size-[58px] rounded-2xl" />
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1.5">
          <span className="size-[7px] rounded-full bg-primary" />
          <span className="size-[7px] rounded-full bg-primary" />
          <span className="size-[7px] rounded-full bg-primary" />
        </div>
      </div>
    </section>
  )
}

const promos = [
  {
    title: ['Lançamentos gênesis', 'de edição limitada'],
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    artwork: 'emerald' as const,
    to: '/mercado' as const,
    search: { aba: 'novos' as const },
  },
  {
    title: ['Arte digital selecionada', 'e muito mais'],
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    artwork: 'ivory' as const,
    to: '/mercado' as const,
    search: { colecoes: 'arte-digital' },
  },
]

export function Promos() {
  return (
    <section aria-label="Destaques do mercado" className="container-page mt-24 grid gap-7 lg:grid-cols-2">
      {promos.map((promo) => (
        <article
          key={promo.title[0]}
          className="reveal group relative flex min-h-[250px] overflow-hidden rounded-lg bg-card transition-shadow duration-500 hover:shadow-[0_24px_48px_-28px_rgb(232_155_85/0.5)]"
        >
          <div className="relative w-[45%] max-w-[292px] shrink-0 overflow-hidden rounded-[18px] bg-[#FBFBFB]">
            <NftImage artwork={promo.artwork} alt="" sizes="292px" className="h-full rounded-[18px] transition-transform duration-700 ease-out-expo motion-safe:group-hover:scale-105" />
            <span aria-hidden="true" className="absolute -bottom-36 -left-40 size-64 rounded-full border-2 border-primary" />
          </div>
          <div className="flex flex-1 flex-col items-end justify-center gap-4 p-5 text-right sm:p-8">
            <h2 className="text-base leading-6 font-bold sm:text-lg">
              {promo.title[0]}
              <br />
              {promo.title[1]}
            </h2>
            <p className="max-w-[263px] text-sm leading-6 text-sand">{promo.text}</p>
            <Link to={promo.to} search={promo.search} className={cn(buttonVariants(), 'group/cta h-10 w-[140px] gap-1 text-sm font-medium')}>
              Explorar <ArrowRightIcon className="size-[18px] transition-transform duration-300 ease-out-expo group-hover/cta:translate-x-1" />
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

const posts = [
  { date: '12 de setembro', read: 6, title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', artwork: 'ivory' as const },
  { date: '13 de setembro', read: 2, title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', artwork: 'emerald' as const },
  { date: '15 de setembro', read: 3, title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', artwork: 'sage' as const },
  { date: '15 de setembro', read: 2, title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', artwork: 'golden' as const },
]

export function Journal() {
  return (
    <section aria-labelledby="journal-title" className="container-page mt-24">
      <h2 id="journal-title" className="text-center text-2xl leading-9 font-bold md:text-[28px]">
        Diário da Cunhagem
      </h2>
      <p className="mt-3 text-center text-sm text-sand">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map((post) => (
          <li key={post.title} className="reveal">
            <article className="group relative flex h-full flex-col overflow-hidden rounded-lg bg-card transition-[translate,box-shadow] duration-500 ease-out-expo hover:shadow-[0_24px_48px_-28px_rgb(232_155_85/0.5)] motion-safe:hover:-translate-y-1">
              <div className="h-[195px] overflow-hidden">
                <NftImage
                  artwork={post.artwork}
                  alt=""
                  sizes="(min-width: 1024px) 268px, 50vw"
                  className="h-full object-[center_30%] transition-transform duration-700 ease-out-expo motion-safe:group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
                <p className="text-xs leading-4 font-medium text-sand">
                  <time>{post.date}</time>&nbsp;&nbsp;|&nbsp;&nbsp;Leitura de {post.read} min
                </p>
                <h3 className="text-base leading-[21px] font-bold">{post.title}</h3>
                <p className="text-xs leading-4 font-medium text-sand">{post.text}</p>
                <Link
                  to="/em-breve"
                  search={{ secao: 'diario' }}
                  className="mt-auto text-xs font-bold text-highlight after:absolute after:inset-0 hover:underline"
                  aria-label={`Ler mais: ${post.title}`}
                >
                  Ler mais{' '}
                  <span aria-hidden="true" className="inline-block transition-transform duration-300 ease-out-expo group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
