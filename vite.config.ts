import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Rotas de entrada mais comuns (auditadas no Lighthouse): renderizam sem esperar um chunk lazy extra. */
const CRITICAL_ROUTES = new Set(['/', '/nft/$nftId'])

/**
 * Inicia o download da camada de mocks (import dinâmico em main.tsx) em paralelo ao bundle
 * principal: as requisições de dados aguardam o MSW, então ele faz parte do caminho crítico.
 */
function preloadMockChunk(): Plugin {
  return {
    name: 'kurio:preload-mocks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const chunk = Object.values(context.bundle ?? {}).find(
          (item) => item.type === 'chunk' && item.facadeModuleId?.replace(/\\/g, '/').endsWith('/src/mocks/browser.ts'),
        )
        if (!chunk) return []
        return [{ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `/${chunk.fileName}` }, injectTo: 'head' }]
      },
    },
  }
}

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      codeSplittingOptions: {
        splitBehavior: ({ routeId }) => (CRITICAL_ROUTES.has(routeId) ? [] : undefined),
      },
    }),
    react(),
    tailwindcss(),
    preloadMockChunk(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // Ver src/mocks/lib/tldts-shim.ts (documentado em ARCHITECTURE.md).
      tldts: path.resolve(import.meta.dirname, './src/mocks/lib/tldts-shim.ts'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Menos requisições no carregamento inicial: dependências estáveis agrupadas por domínio.
        codeSplitting: {
          minSize: 12_000,
          groups: [
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'tanstack', test: /[\\/]node_modules[\\/]@tanstack[\\/]/ },
            { name: 'radix', test: /[\\/]node_modules[\\/](@radix-ui|radix-ui|@floating-ui|react-remove-scroll|aria-hidden)[\\/]/ },
            { name: 'zod', test: /[\\/]node_modules[\\/]zod[\\/]/ },
          ],
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
})
