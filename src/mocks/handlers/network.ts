import { delay, http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/shared/config'
import { errorResponse } from '../lib/http'
import { hashString } from '../lib/random'
import { currentScenario, isOffline, type LatencyProfile } from '../scenarios'

const attempts = new Map<string, number>()

function latencyFor(profile: LatencyProfile, url: URL) {
  if (profile.kind === 'fixed') return profile.ms
  const span = profile.max - profile.min
  return profile.min + (hashString(url.pathname + url.search) % (span + 1))
}

/**
 * Primeiro handler da cadeia: aplica latência e falhas do cenário ativo.
 * Quando não há falha, não retorna resposta e a requisição segue para o handler do recurso.
 */
export const networkConditions = http.all(`${API_BASE_URL}/*`, async ({ request }) => {
  const url = new URL(request.url)
  if (isOffline()) return HttpResponse.error()

  const scenario = currentScenario()
  const profile = request.method === 'GET' ? scenario.latency.read : scenario.latency.write
  await delay(latencyFor(profile, url))

  for (const rule of scenario.failures ?? []) {
    if (rule.method !== '*' && rule.method !== request.method) continue
    if (!rule.path.test(url.pathname)) continue
    if (rule.times) {
      const key = `${request.method} ${url.pathname}${url.search}`
      const count = attempts.get(key) ?? 0
      attempts.set(key, count + 1)
      if (count >= rule.times) continue
    }
    if (rule.networkError) return HttpResponse.error()
    return errorResponse(rule.status, rule.code, rule.message)
  }
  return undefined
})

export function resetNetworkAttempts() {
  attempts.clear()
}
