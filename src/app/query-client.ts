import { MutationCache, QueryClient } from '@tanstack/react-query'
import { toApiError } from '@/api/errors'

/**
 * Política de cache (documentada em ARCHITECTURE.md):
 *  - consultas ficam frescas por 30 s e saem da memória 5 min após o último uso;
 *  - até 2 novas tentativas, com backoff exponencial, apenas para falhas transitórias
 *    (rede, timeout, 5xx). Erros 4xx são definitivos;
 *  - mutations nunca são repetidas automaticamente (pedido usa idempotência explícita).
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => toApiError(error).retryable && failureCount < 2,
        retryDelay: (attempt) => Math.min(600 * 2 ** attempt, 4_000),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
    mutationCache: new MutationCache({
      onError: (error) => {
        if (import.meta.env.DEV) console.warn('[mutation]', toApiError(error).code, toApiError(error).message)
      },
    }),
  })
}
