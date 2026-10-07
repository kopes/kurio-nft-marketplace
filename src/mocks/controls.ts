/**
 * API de controle dos mocks exposta em `window.__KURIO_MOCKS__`.
 * Usada pelo painel de cenários e pelos testes Playwright para trocar cenários,
 * resetar dados e disparar eventos de tempo real pelo servidor Socket.IO simulado.
 */
import type { EditionId } from '@/shared/contracts'
import { db, mutate, resetDb } from './db'
import { resetAccountScenarioFlags } from './handlers/account'
import { resetCartScenarioFlags } from './handlers/cart'
import { resetNetworkAttempts } from './handlers/network'
import { resetOrderScenarioFlags } from './handlers/orders'
import { connectedClients, dropConnections, emitStaleNftEvent, replayLastEvent } from './realtime'
import { getSettings, scenarios, setOffline, setScenario, type ScenarioId } from './scenarios'
import { findNft } from './services/catalog'
import { changeEditionAvailability, changeNftPrice } from './services/nfts'
import { clearOrderTimers, settleOrder } from './services/orders'

function resetRuntimeFlags() {
  resetNetworkAttempts()
  resetCartScenarioFlags()
  resetOrderScenarioFlags()
  resetAccountScenarioFlags()
  clearOrderTimers()
}

export const mockControls = {
  scenarios: Object.values(scenarios).map(({ id, label, description }) => ({ id, label, description })),
  getSettings,
  setScenario(id: ScenarioId) {
    setScenario(id)
    resetRuntimeFlags()
  },
  setOffline(offline: boolean) {
    setOffline(offline)
    if (offline) dropConnections()
  },
  /** Restaura integralmente o cenário conhecido (fixtures) e limpa contadores de falha. */
  async reset() {
    resetRuntimeFlags()
    await resetDb()
  },
  changePrice(nftId: string, price?: string, options?: { silent?: boolean }) {
    return changeNftPrice(nftId, price, options)
  },
  setAvailability(nftId: string, editionId: EditionId, available: number) {
    return changeEditionAvailability(nftId, editionId, available)
  },
  /** Expira todas as sessões ativas: a próxima requisição autenticada recebe 401 SESSION_EXPIRED. */
  expireSessions() {
    mutate((draft) => {
      for (const session of draft.sessions) session.expiresAt = new Date(Date.now() - 1000).toISOString()
    })
  },
  settleOrder,
  getNft(nftId: string) {
    const { price, version, editions } = findNft(nftId)
    return { price, version, editions: editions.map((edition) => ({ ...edition })) }
  },
  realtime: {
    drop: dropConnections,
    replayLast: replayLastEvent,
    emitStale(nftId: string, price = '0.01') {
      return emitStaleNftEvent(findNft(nftId), price)
    },
    clients: connectedClients,
  },
  snapshot() {
    return structuredClone(db())
  },
}

export type MockControls = typeof mockControls

declare global {
  interface Window {
    __KURIO_MOCKS__?: MockControls
  }
}
