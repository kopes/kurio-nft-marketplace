import type { ArtworkId, CollectionId, EditionId, EditionStatus, NetworkId } from '@/shared/contracts'
import { collectionLabels } from '@/shared/contracts'
import { createRandom, hexHash } from '../lib/random'

export interface EditionRecord {
  id: EditionId
  label: string
  supply: number | null
  available: number
  maxPerOrder: number
  status: EditionStatus
}

export interface NftRecord {
  id: string
  name: string
  tokenId: string
  artwork: ArtworkId
  collection: CollectionId
  collectionName: string
  network: NetworkId
  price: string
  compareAtPrice: string | null
  rarity: 'raro' | 'lendario' | null
  isNewRelease: boolean
  popularity: number
  listedAt: string
  description: string
  story: string[]
  attributes: string[]
  rating: number
  reviewsCount: number
  editions: EditionRecord[]
  contractAddress: string
  royaltyPercent: number
  creator: string
  gallery: ArtworkId[]
  reviews: Array<{ id: string; author: string; rating: number; comment: string; createdAt: string }>
  featured: boolean
  version: number
}

/** Data de referência das fixtures: mantém "novos lançamentos" estáveis entre execuções. */
export const FIXTURE_NOW = Date.parse('2026-09-15T12:00:00.000Z')
const DAY = 86_400_000

const seriesByArtwork: Record<ArtworkId, string[]> = {
  emerald: ['Emerald Ape', 'Jade Courier', 'Velvet Varsity', 'Amber Lens', 'Copper Crown'],
  sage: ['Sage Nomad', 'Violet Nomad', 'Cosmic Bloom', 'Lilac Drifter', 'Misty Ranger'],
  ivory: ['Ivory Baron', 'Neon Vessel', 'Onyx Regent', 'Midnight Envoy', 'Silver Patron'],
  golden: ['Golden Beat', 'Golden Signal', 'Solar Groove', 'Honey Echo', 'Rustic Tempo'],
}

const attributesByArtwork: Record<ArtworkId, string[]> = {
  emerald: ['Óculos', 'Esmeralda', 'Jaqueta college'],
  sage: ['Chapéu bucket', 'Moletom lilás', 'Olhar sereno'],
  ivory: ['Blazer marfim', 'Gola alta', 'Brinco dourado'],
  golden: ['Fones verdes', 'Pelagem dourada', 'Jaqueta bomber'],
}

const creators = ['Nova Sato', 'Lia Moreira', 'Caio Andrade', 'Rafa Kim', 'Duda Prado']

const reviewAuthors = ['Marina Costa', 'Pedro Alves', 'Júlia Nakamura', 'Thiago Rocha', 'Camila Duarte', 'Rafael Souza']
const reviewComments = [
  'Arte impecável e procedência clara. A entrega na carteira foi imediata.',
  'Os detalhes em alta resolução valem cada ETH. Coleção muito bem curada.',
  'Ótimo atendimento do criador e acesso exclusivo aos próximos lançamentos.',
  'Paleta incrível. Fica ainda melhor exibido em tela grande.',
  'Comprei a edição 1/50 e já recebi o desbloqueável. Recomendo!',
]

/** Os oito primeiros itens reproduzem exatamente os cards do Figma. */
const designed: Array<{
  name: string
  artwork: ArtworkId
  price: string
  compareAtPrice?: string
  rarity?: 'raro'
  collection: CollectionId
  network: NetworkId
}> = [
  { name: 'Emerald Ape #042', artwork: 'emerald', price: '1.19', collection: 'arte-digital', network: 'ethereum' },
  { name: 'Sage Nomad #009', artwork: 'sage', price: '1.69', collection: 'arte-digital', network: 'ethereum' },
  { name: 'Neon Vessel #552', artwork: 'ivory', price: '1.99', compareAtPrice: '2.29', rarity: 'raro', collection: 'colecionaveis', network: 'ethereum' },
  { name: 'Cosmic Bloom #118', artwork: 'sage', price: '1.29', collection: 'generativa', network: 'polygon' },
  { name: 'Violet Nomad #314', artwork: 'sage', price: '1.39', collection: 'arte-digital', network: 'ethereum' },
  { name: 'Ivory Baron #088', artwork: 'ivory', price: '1.79', collection: 'arte-3d', network: 'ethereum' },
  { name: 'Golden Beat #207', artwork: 'golden', price: '0.99', collection: 'musica', network: 'solana' },
  { name: 'Golden Signal #160', artwork: 'golden', price: '0.39', collection: 'musica', network: 'polygon' },
]

const artworkOrder: ArtworkId[] = ['emerald', 'sage', 'ivory', 'golden']

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/#/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function formatPrice(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, '') || '0'
}

function buildEditions(random: ReturnType<typeof createRandom>, index: number): EditionRecord[] {
  const soldOutOneOfOne = index % 4 === 1
  const tenAvailable = index % 7 === 3 ? 0 : random.int(2, 10)
  const fiftyAvailable = random.int(8, 50)
  const openUnavailable = index % 6 === 5
  return [
    { id: '1-1', label: '1/1', supply: 1, available: soldOutOneOfOne ? 0 : 1, maxPerOrder: 1, status: soldOutOneOfOne ? 'sold_out' : 'available' },
    { id: '1-10', label: '1/10', supply: 10, available: tenAvailable, maxPerOrder: 3, status: tenAvailable === 0 ? 'sold_out' : 'available' },
    { id: '1-50', label: '1/50', supply: 50, available: fiftyAvailable, maxPerOrder: 10, status: 'available' },
    {
      id: 'aberta',
      label: 'ABERTA',
      supply: null,
      available: openUnavailable ? 0 : 999,
      maxPerOrder: 20,
      status: openUnavailable ? 'unavailable' : 'available',
    },
  ]
}

function describe(name: string, collectionName: string, network: NetworkId, edition: string, creator: string) {
  const chain = network === 'ethereum' ? 'Ethereum' : network === 'polygon' ? 'Polygon' : 'Solana'
  return {
    description: `Um colecionável digital finalizado à mão da coleção ${collectionName}, verificado na ${chain}, com arte desbloqueável e acesso para colecionadores.`,
    story: [
      `${name} é uma obra digital ${edition} finalizada à mão da coleção ${collectionName}. Cada atributo fica armazenado nos metadados do token e verificado na ${chain}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
      `A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. ${creator} recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.`,
    ],
  }
}

export function buildNftFixtures(): NftRecord[] {
  const random = createRandom(20260915)
  const records: NftRecord[] = []
  const total = 42

  for (let index = 0; index < total; index++) {
    const preset = designed[index]
    const artwork = preset?.artwork ?? artworkOrder[index % artworkOrder.length]
    const number = preset ? preset.name.split('#')[1] : String(random.int(1, 999)).padStart(3, '0')
    const name = preset?.name ?? `${random.pick(seriesByArtwork[artwork])} #${number}`
    const collection = preset?.collection ?? (Object.keys(collectionLabels) as CollectionId[])[index % 9]
    const network = preset?.network ?? (['ethereum', 'polygon', 'solana'] as const)[(index * 7) % 3]
    const basePrice = preset ? Number(preset.price) : 0.05 + random.next() * 4.5
    let price = preset?.price ?? formatPrice(basePrice)
    if (index === 40) price = '0.02'
    if (index === 41) price = '12.3'
    const hasDiscount = !preset && index % 9 === 4
    const compareAtPrice = preset?.compareAtPrice ?? (hasDiscount ? formatPrice(Number(price) * 1.2) : null)
    const rarity = preset ? (preset.rarity ?? null) : index % 11 === 6 ? 'raro' : index === 23 ? 'lendario' : null
    const creator = creators[index % creators.length]
    const collectionName = artwork === 'golden' ? 'Kurio Sound' : artwork === 'ivory' ? 'Kurio Regents' : 'Kurio Apes'
    const listedAt = new Date(FIXTURE_NOW - index * 1.7 * DAY - random.int(0, 20) * 3_600_000).toISOString()
    const editionLabel = index % 3 === 0 ? '1/50' : index % 3 === 1 ? '1/10' : '1/1'
    const id = slugify(name) + (records.some((record) => record.id === slugify(name)) ? `-${index}` : '')
    const { description, story } = describe(name, collectionName, network, editionLabel, creator)

    records.push({
      id,
      name,
      tokenId: `#${number.padStart(4, '0')}`,
      artwork,
      collection,
      collectionName,
      network,
      price,
      compareAtPrice,
      rarity,
      isNewRelease: FIXTURE_NOW - Date.parse(listedAt) < 21 * DAY,
      popularity: random.int(10, 500) + (preset ? 400 : 0),
      listedAt,
      description,
      story,
      attributes: [...attributesByArtwork[artwork].slice(0, 2), rarity === 'raro' ? 'Raro' : rarity === 'lendario' ? 'Lendário' : 'Comum'],
      rating: Math.round((4 + random.next()) * 10) / 10,
      reviewsCount: random.int(3, 40),
      editions: buildEditions(random, index),
      contractAddress: `0x7A42${hexHash(name, 32).toUpperCase()}19E8`,
      royaltyPercent: 5,
      creator,
      gallery: [artwork, artwork, artwork, artwork],
      reviews: Array.from({ length: 3 }, (_, reviewIndex) => ({
        id: `rev-${index}-${reviewIndex}`,
        author: reviewAuthors[(index + reviewIndex) % reviewAuthors.length],
        rating: reviewIndex === 2 ? 4 : 5,
        comment: reviewComments[(index * 2 + reviewIndex) % reviewComments.length],
        createdAt: new Date(FIXTURE_NOW - (reviewIndex + 1) * 3 * DAY).toISOString(),
      })),
      featured: index === 1,
      version: 1,
    })
  }

  // Emerald Ape #042 replica os dados exibidos no frame de detalhe.
  const emerald = records[0]
  emerald.rating = 4.8
  emerald.reviewsCount = 19
  emerald.attributes = ['Óculos', 'Esmeralda', 'Raro']
  emerald.creator = 'Nova Sato'
  emerald.editions = [
    { id: '1-1', label: '1/1', supply: 1, available: 1, maxPerOrder: 1, status: 'available' },
    { id: '1-10', label: '1/10', supply: 10, available: 4, maxPerOrder: 3, status: 'available' },
    { id: '1-50', label: '1/50', supply: 50, available: 32, maxPerOrder: 10, status: 'available' },
    { id: 'aberta', label: 'ABERTA', supply: null, available: 0, maxPerOrder: 20, status: 'unavailable' },
  ]

  return records
}
