import type { EditionId } from '@/shared/contracts'
import { addEth } from '@/shared/eth'
import { mutate } from '../db'
import { publishNftUpdated } from '../realtime'
import { findNft } from './catalog'

/** Altera o preço de um NFT, incrementa a versão e publica `nft.updated` (REST e evento sempre consistentes). */
export function changeNftPrice(nftId: string, nextPrice?: string, { silent = false }: { silent?: boolean } = {}) {
  const record = findNft(nftId)
  const previousPrice = record.price
  mutate(() => {
    record.price = nextPrice ?? addEth(record.price, '0.1')
    record.version += 1
  })
  // `silent` simula um evento perdido (ex.: cliente desconectado): só a API REST reflete a mudança.
  return silent ? { id: null, version: record.version } : publishNftUpdated(record, previousPrice, 'price')
}

/** Ajusta a disponibilidade de uma edição (0 = esgotada) e publica `nft.updated`. */
export function changeEditionAvailability(nftId: string, editionId: EditionId, available: number) {
  const record = findNft(nftId)
  const edition = record.editions.find((item) => item.id === editionId)
  if (!edition) throw new Error(`Edição ${editionId} inexistente em ${nftId}`)
  mutate(() => {
    edition.available = Math.max(0, available)
    if (edition.status !== 'unavailable') edition.status = edition.available === 0 ? 'sold_out' : 'available'
    record.version += 1
  })
  return publishNftUpdated(record, record.price, 'availability')
}
