import { realtimeHandler } from '../realtime'
import { profileHandlers, walletHandlers } from './account'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { catalogHandlers, favoriteHandlers } from './catalog'
import { networkConditions } from './network'
import { orderHandlers } from './orders'

/** A ordem importa: `networkConditions` aplica latência/falhas antes dos handlers de recurso. */
export const handlers = [
  networkConditions,
  ...authHandlers,
  ...catalogHandlers,
  ...favoriteHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...profileHandlers,
  ...walletHandlers,
  realtimeHandler,
]
