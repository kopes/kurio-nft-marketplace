import { setupWorker } from 'msw/browser'
import { mockControls } from './controls'
import { initDb } from './db'
import { handlers } from './handlers'
import { loadSettings } from './scenarios'
import { resumePendingOrders } from './services/orders'

/** Inicializa banco, cenário e service worker. Resolve quando as requisições já são interceptadas. */
export async function startMockServer() {
  loadSettings()
  await initDb()
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: !import.meta.env.DEV,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
  resumePendingOrders()
  window.__KURIO_MOCKS__ = mockControls
  return worker
}
