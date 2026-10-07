/**
 * Barreira de inicialização dos mocks. A interface renderiza imediatamente (hero, skeletons),
 * mas requisições REST e o socket aguardam o service worker do MSW estar ativo.
 */
let resolveReady: () => void = () => {}

export const mocksReady = new Promise<void>((resolve) => {
  resolveReady = resolve
})

export function markMocksReady() {
  resolveReady()
}
