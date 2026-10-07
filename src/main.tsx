import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import { markMocksReady } from '@/app/mocks-ready'
import { createQueryClient } from '@/app/query-client'
import { createAppRouter } from '@/app/router'
import { MOCKS_ENABLED } from '@/shared/config'

const queryClient = createQueryClient()
const router = createAppRouter(queryClient)

/**
 * Os mocks são carregados sob demanda (chunk separado) e em paralelo à renderização:
 * a interface aparece imediatamente e as requisições aguardam `mocksReady`.
 */
async function bootstrapMocks() {
  if (!MOCKS_ENABLED) return
  const { startMockServer } = await import('@/mocks/browser')
  await startMockServer()
}

bootstrapMocks()
  .catch((error) => console.error('[mocks] falha ao iniciar a API simulada', error))
  .finally(markMocksReady)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
