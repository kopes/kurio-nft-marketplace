/**
 * Painel de cenários da API simulada (disponível quando VITE_ENABLE_MOCKS=true, inclusive no build de demonstração).
 * Todas as ações passam pela camada de mocks (MSW) — a interface nunca é alterada diretamente.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { mocksReady } from '@/app/mocks-ready'
import { queryKeys } from '@/api/query-keys'
import type { Cart } from '@/shared/contracts'
import { cartScope } from '@/features/session/session-store'
import { useRealtimeStatus } from '@/features/realtime/realtime-bridge'

const statusLabels = {
  idle: 'inativo',
  connecting: 'conectando…',
  connected: 'conectado',
  reconnecting: 'reconectando…',
  disconnected: 'desconectado',
} as const

export default function ScenarioPanel() {
  const queryClient = useQueryClient()
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState(() => window.__KURIO_MOCKS__?.getSettings())
  const realtime = useRealtimeStatus()

  useEffect(() => {
    void mocksReady.then(() => {
      setReady(Boolean(window.__KURIO_MOCKS__))
      setSettings(window.__KURIO_MOCKS__?.getSettings())
    })
    const onChange = () => setSettings(window.__KURIO_MOCKS__?.getSettings())
    window.addEventListener('kurio:mock-settings', onChange)
    return () => window.removeEventListener('kurio:mock-settings', onChange)
  }, [])

  const mocks = window.__KURIO_MOCKS__
  // Testes E2E e auditorias ocultam o botão flutuante com localStorage "kurio.mock.panel" = "hidden".
  const hidden = (() => {
    try {
      return localStorage.getItem('kurio.mock.panel') === 'hidden'
    } catch {
      return false
    }
  })()
  if (!ready || !mocks || !settings || hidden) return null

  const firstCartItem = () => queryClient.getQueryData<Cart>(queryKeys.cart.detail(cartScope()))?.items[0]

  const run = (label: string, action: () => unknown) => {
    try {
      action()
      toast.info(`Simulação: ${label}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha na simulação')
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        {/* Só no desktop: no mobile o botão cobria as barras de ação fixas (cenários via ?scenario= ou console). */}
        <button
          type="button"
          className="fixed bottom-3 left-3 z-40 hidden rounded-full border border-primary bg-ink/90 px-3 py-1.5 text-[11px] font-bold text-highlight shadow-lg md:block"
          aria-label="Abrir painel de cenários da API simulada"
        >
          Cenários · {settings.scenario}
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[340px] overflow-y-auto border-line p-5 sm:max-w-[360px]">
        <SheetHeader className="p-0">
          <SheetTitle className="text-lg font-bold">API simulada (MSW)</SheetTitle>
          <SheetDescription className="text-sand">Cenários determinísticos e eventos Socket.IO para demonstração e testes.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2">
          <label htmlFor="scenario-select" className="text-sm font-bold">
            Cenário ativo
          </label>
          <select
            id="scenario-select"
            value={settings.scenario}
            onChange={(event) => {
              mocks.setScenario(event.target.value as typeof settings.scenario)
              void queryClient.invalidateQueries()
            }}
            className="h-10 rounded-sm border border-input bg-card px-2 text-sm"
          >
            {mocks.scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-sand">{mocks.scenarios.find((item) => item.id === settings.scenario)?.description}</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">Rede</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.offline} onChange={(event) => mocks.setOffline(event.target.checked)} className="size-4 accent-primary" />
            Simular queda de conexão
          </label>
          <p className="text-xs text-sand">Tempo real: {statusLabels[realtime]}</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">Eventos em tempo real</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const item = firstCartItem()
              if (!item) return toast.error('Adicione um item ao carrinho primeiro.')
              run('preço alterado', () => mocks.changePrice(item.nftId))
            }}
          >
            Alterar preço do 1º item do carrinho
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const item = firstCartItem()
              if (!item) return toast.error('Adicione um item ao carrinho primeiro.')
              run('edição esgotada', () => mocks.setAvailability(item.nftId, item.editionId, 0))
            }}
          >
            Esgotar edição do 1º item
          </Button>
          <Button size="sm" variant="outline" onClick={() => run('evento duplicado', () => mocks.realtime.replayLast())}>
            Reenviar último evento (duplicado)
          </Button>
          <Button size="sm" variant="outline" onClick={() => run('evento antigo', () => mocks.realtime.emitStale(firstCartItem()?.nftId ?? 'emerald-ape-042'))}>
            Enviar evento antigo
          </Button>
          <Button size="sm" variant="outline" onClick={() => run('queda do tempo real', () => mocks.realtime.drop())}>
            Derrubar conexão de tempo real
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">Sessão e dados</p>
          <Button size="sm" variant="outline" onClick={() => run('sessão expirada', () => mocks.expireSessions())}>
            Expirar sessão agora
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={async () => {
              await mocks.reset()
              // Restaura também o estado do cliente (sessão, carrinho de visitante, rascunhos).
              for (const key of Object.keys(localStorage)) if (key.startsWith('kurio.') && !key.startsWith('kurio.mock.')) localStorage.removeItem(key)
              sessionStorage.clear()
              window.location.reload()
            }}
          >
            Resetar dados simulados
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
