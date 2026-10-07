# Kurio — Marketplace de NFTs

Implementação do desafio [Marketplace de NFTs](docs/DESAFIO.md) em React + TypeScript, a partir do [layout no Figma](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1).

Todas as APIs, a autenticação, as carteiras, os pagamentos e os eventos em tempo real funcionam com dados simulados pelo **MSW**, inclusive no build de demonstração. Detalhes de arquitetura, contratos, cache, sessão, reconciliação REST × Socket.IO, decisões de UX e desvios do Figma estão em [ARCHITECTURE.md](ARCHITECTURE.md).

- **Deploy:** https://kurio-nft-marketplace-roan.vercel.app
- **Repositório:** https://github.com/kopes/kurio-nft-marketplace

## Stack

| Responsabilidade | Tecnologia |
| --- | --- |
| Interface | React 19 |
| Linguagem | TypeScript 6 (strict) |
| Roteamento | TanStack Router (rotas por arquivo, search params tipados com zod) |
| Estado remoto | TanStack Query 5 |
| Cliente HTTP | Axios (cliente único com interceptors e validação de contratos) |
| Integração de dados | REST (`/api/*`) |
| Tempo real | Socket.IO (`socket.io-client`) |
| Estilização | Tailwind CSS 4 (tokens do Figma) |
| Componentes | shadcn/ui (Radix) adaptado à identidade visual |
| Mocking | MSW 2 (Service Worker + `ws.link`) e `@mswjs/socket.io-binding` |
| Testes E2E e regressão visual | Playwright |
| Auditoria | Lighthouse 13 |
| Build | Vite 8 (Rolldown) |

## Requisitos

- Node.js **≥ 20.19**
- pnpm **10** (`corepack enable` ativa a versão de `packageManager`)

## Setup

```bash
pnpm install
pnpm exec playwright install chromium   # apenas para testes e Lighthouse
pnpm dev                                 # http://localhost:5173 (mocks ativos)
```

A aplicação roda a partir de um checkout limpo, sem backend nem serviços privados.

## Variáveis de ambiente

Os valores padrão estão em [`.env`](.env); [`.env.example`](.env.example) documenta cada variável.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Ativa a API REST e o Socket.IO simulados (MSW), inclusive no build de demonstração. |
| `VITE_API_BASE_URL` | `/api` | Base da API REST. |
| `VITE_REALTIME_URL` | `wss://realtime.kurio.local` | Endpoint Socket.IO. Com mocks, é interceptado pelo MSW (não existe servidor real). |

## Comandos

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Desenvolvimento com mocks. |
| `pnpm build` | Verificação de tipos + build de produção (`dist/`). |
| `pnpm preview` | Serve o build em `http://localhost:4173`. |
| `pnpm typecheck` | Verificação de tipos (app, testes e configs). |
| `pnpm lint` | ESLint. |
| `pnpm test:e2e` | Testes Playwright (desktop e mobile, Chromium). Gera o build e o serve automaticamente. |
| `pnpm test:e2e:desktop` / `pnpm test:e2e:mobile` | Apenas um projeto (viewport). |
| `pnpm test:e2e:update` | Atualiza as baselines de regressão visual. |
| `pnpm test:e2e:report` | Abre o relatório HTML (`playwright-report/`), com traces e vídeos das falhas. |
| `pnpm lighthouse` | Auditoria Lighthouse do build (rode `pnpm build` antes). |

## Credenciais fictícias

| Usuário | E-mail | Senha | Observações |
| --- | --- | --- | --- |
| Ana Ribeiro | `ana@kurio.dev` | `Kurio2026` | Carteiras principal (Ethereum) e secundária (Polygon); 2 favoritos. |
| Bruno Lima | `bruno@kurio.dev` | `Kurio2026` | Sem carteiras cadastradas; 1 favorito. |

Com a API simulada ativa (`VITE_ENABLE_MOCKS=true`), o formulário de login já vem preenchido com a conta da Ana. Basta clicar em **Entrar**.

As senhas não ficam salvas em claro: o banco simulado guarda apenas o hash PBKDF2-SHA256 com salt.

**Cupons:** `KURIO10` (10%), `GENESIS` (0.05 ETH, subtotal mínimo de 0.5 ETH) e `VERAO25` (expirado). Qualquer outro código é inválido.

## Cenários da API simulada

Os cenários são determinísticos: as fixtures são fixas, a latência vem de uma função fixa da URL e as falhas são contadas por URL. Há três formas de escolher um cenário:

1. **URL:** `http://localhost:5173/?scenario=payment-declined` (o cenário fica salvo).
2. **Painel "Cenários"**, o botão flutuante no canto inferior esquerdo (só a partir de 768 px; no mobile ele cobriria as barras de ação fixas). Ele também dispara eventos de tempo real, expira a sessão e reseta os dados.
3. **Console ou testes:** `window.__KURIO_MOCKS__.setScenario('slow')`.

| Cenário | Efeito |
| --- | --- |
| `default` | Latência estável (180 ms leitura / 260 ms escrita) e sucesso. |
| `empty` | Catálogo sem resultados. |
| `slow` | Leituras de 2,5 s e escritas de 1,2 s (skeletons visíveis). |
| `variable-latency` | Latência entre 80 ms e 2,4 s, derivada de cada URL: respostas fora de ordem. |
| `offline` | Todas as requisições falham por queda de conexão; o socket é recusado. |
| `server-error` | Catálogo e detalhe respondem HTTP 500. |
| `transient-failure` | A primeira tentativa de cada leitura responde 503; o retry automático recupera. |
| `session-expired` | Sessões expiram 45 s após o login. |
| `forbidden` | Perfil e carteiras respondem 403. |
| `favorites-failure` | Favoritar e desfavoritar respondem 500 (rollback otimista). |
| `wallet-rejected` | A primeira conexão de carteira é recusada. |
| `price-change` | No pagamento, o preço do 1º item sobe 4 s após a cotação (`nft.updated`). |
| `sold-out` | A primeira tentativa de pedido encontra a edição do 1º item esgotada. |
| `order-timeout` | O pedido é criado, mas a resposta demora 12 s (o timeout do cliente é 8 s); o retry recupera o mesmo pedido. |
| `payment-declined` | O pedido fica pendente e depois é recusado. |
| `payment-pending` | O pedido fica pendente por 20 s antes de confirmar. |

**Reset:** o botão "Resetar dados simulados" do painel (ou `await window.__KURIO_MOCKS__.reset()`) restaura as fixtures e limpa sessão, carrinho de visitante e rascunhos. O estado simulado fica no `localStorage` (`kurio.mock.db`) e sobrevive a refresh.

### API de controle (`window.__KURIO_MOCKS__`)

```js
setScenario(id) · setOffline(bool) · reset()
changePrice(nftId, price?, { silent? })   // publica nft.updated (silent: só REST)
setAvailability(nftId, editionId, n)      // ex.: 0 = edição esgotada
expireSessions()                          // próxima requisição autenticada → 401 SESSION_EXPIRED
settleOrder(orderId)                      // conclui um pedido pendente agora
realtime.drop() · realtime.replayLast() · realtime.emitStale(nftId) · realtime.clients()
snapshot()                                // cópia do banco simulado
```

## Como reproduzir os fluxos de falha

| Fluxo | Passos |
| --- | --- |
| Carregamento lento e skeletons | `/?scenario=slow`. |
| Falha e nova tentativa | `/mercado?scenario=offline` mostra o erro; no painel, troque para `default` e clique em "Tentar novamente". |
| Respostas fora de ordem | `/mercado?scenario=variable-latency` e digite na busca devagar (ex.: `s`, `so`, `sol`…). |
| Sessão expirada | Entre, abra o painel e clique em "Expirar sessão agora", depois navegue para uma tela privada. O login reabre com o contexto preservado e você volta à mesma tela. |
| Favoritar com falha | Cenário `favorites-failure`, entre e favorite um NFT: o coração volta ao estado anterior e o erro é anunciado. |
| Cupom inválido ou expirado | No carrinho, aplique `XYZ` ou `VERAO25`. |
| Preço alterado no checkout | Cenário `price-change`, ou no painel "Alterar preço do 1º item do carrinho", com o pagamento aberto. O aviso aparece e a revisão exige nova confirmação. |
| Edição esgotada na compra | Cenário `sold-out` e confirme a compra. |
| Cliques repetidos | Clique várias vezes em "Confirmar e pagar": um único pedido é criado (chave de idempotência). |
| Timeout após criar o pedido | Cenário `order-timeout`: após cerca de 8 s o cliente repete com a mesma `Idempotency-Key` e recupera `ord_0001`. |
| Pagamento recusado | Cenário `payment-declined`: o carrinho é preservado e "Tentar novamente" cria um novo pedido. |
| Pedido pendente + desconexão | Cenário `payment-pending`, confirme, use "Derrubar conexão de tempo real" no painel e recarregue: o pedido é recuperado sem criar outra compra. |
| Eventos duplicados ou antigos | No painel: "Reenviar último evento" e "Enviar evento antigo". |
| Carteira recusa a conexão | Cenário `wallet-rejected` e clique em "Confirmar compra". |
| Acesso negado | Cenário `forbidden` e abra `/perfil/carteiras`. |

## Testes (Playwright)

São 102 testes, 51 por projeto (`desktop-chromium` em 1440×900 e `mobile-chromium` em 390×844), executados contra o build de demonstração com MSW. Cada teste parte de um contexto isolado: `localStorage` vazio faz o banco simulado voltar às fixtures.

| # | Requisito | Arquivo |
| --- | --- | --- |
| 1 | Busca, filtros combinados, ordenação, paginação, histórico e respostas fora de ordem | `e2e/catalog.spec.ts` |
| 2 | Acesso direto ao detalhe, NFT inexistente, edição indisponível e limite | `e2e/nft-detail.spec.ts` |
| 3 | Cadastro, login, expiração de sessão, logout e troca de usuário | `e2e/auth.spec.ts` |
| 4 | Favoritos, falha de mutation e rollback | `e2e/favorites.spec.ts` |
| 5 | Carrinho, quantidades, remoção, cupom, refresh e merge no login | `e2e/cart.spec.ts` |
| 6 | Compra completa até o recibo (snapshot) | `e2e/purchase.spec.ts` |
| 7 | Pagamento recusado, cliques repetidos e timeout com idempotência | `e2e/payment-failures.spec.ts` |
| 8 | Perfil, avatar, senha e carteiras com validações | `e2e/account.spec.ts` |
| 9–10 | Preço via Socket.IO no checkout, duplicatas, eventos antigos, desconexão e pedido pendente | `e2e/realtime.spec.ts` |
| 11–12 | Teclado, foco em diálogos e drawers, formulários, skeletons e recuperação | `e2e/a11y-loading.spec.ts` |
| — | Regressão visual (início, detalhe, carrinho e pagamento) | `e2e/visual.spec.ts` |

- Os testes de tempo real passam pelo `socket.io-client` (eventos emitidos pelo servidor simulado), e os de REST passam pelos handlers MSW.
- Tempo, latência e eventos são controlados pelos cenários e pela API de controle; a regressão visual usa `page.clock` e movimento reduzido.
- As baselines ficam em `e2e/__screenshots__/` e incluem a plataforma no nome (as atuais foram geradas em `win32`). Em outro sistema, gere novas com `pnpm test:e2e:update`.
- O relatório HTML fica em `playwright-report/`, e traces, vídeos e screenshots das falhas em `test-results/`.

## Lighthouse

Configuração em [`lighthouse/config.mjs`](lighthouse/config.mjs) e runner em [`lighthouse/run.mjs`](lighthouse/run.mjs). São 3 execuções por página e perfil, cada uma com um Chrome novo, sobre o build de produção com o cenário padrão dos mocks. Os relatórios HTML/JSON e o resumo estão em [`lighthouse/reports/`](lighthouse/reports/summary.md).

Mediana de 3 execuções:

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Início | mobile | 79 | 100 | 100 | 100 | 4120 ms | 0.021 | 198 ms |
| Início | desktop | 99 | 100 | 100 | 100 | 758 ms | 0 | 0 ms |
| Detalhe | mobile | 83 | 100 | 100 | 100 | 3684 ms | 0 | 119 ms |
| Detalhe | desktop | 99 | 100 | 100 | 100 | 813 ms | 0.022 | 0 ms |

Ambiente da medição: Lighthouse 13.5.0, Chrome 153 (headless), Node 20.19.6, Windows 11 x64, Intel Core Ultra 9 285, 32 GB, servido por `vite preview` (HTTP/1.1).

A Performance mobile (79 e 83) fica abaixo da meta de 90. O LCP das duas páginas é uma imagem que depende da resposta da API, e no build de demonstração essa resposta só chega depois de baixar o chunk do MSW (64 KB gzip) e registrar o Service Worker, sob throttling de 4G lento. A análise completa e as otimizações feitas estão em [ARCHITECTURE.md › Performance](ARCHITECTURE.md#performance-e-lighthouse).

## Deploy

Publicado na Vercel em **https://kurio-nft-marketplace-roan.vercel.app**. O [`vercel.json`](vercel.json) faz o fallback SPA, define o cache dos assets e libera o Service Worker do MSW, e o [`.vercelignore`](.vercelignore) evita enviar relatórios e artefatos locais. Também há `public/_redirects` para a Netlify.

```bash
pnpm dlx vercel login
pnpm dlx vercel deploy --prod
```

A versão publicada roda com os mocks e o tempo real ativos (`VITE_ENABLE_MOCKS=true`). O acesso direto e o refresh das rotas funcionam por causa do fallback para `index.html`. A suíte Playwright completa passa também contra a URL publicada (basta trocar o `baseURL` e remover o `webServer` da configuração).

## Estrutura

```
src/
  api/            cliente Axios, erros normalizados, endpoints tipados, chaves de cache
  app/            QueryClient, router, barreira de inicialização dos mocks
  components/     ui (shadcn adaptado), layout, nft, common, ícones exportados do Figma
  features/       catalog, nft, cart, checkout, orders, account, favorites, session, realtime, home, dev
  mocks/          banco simulado, fixtures, cenários, handlers REST, servidor Socket.IO, API de controle
  routes/         rotas por arquivo (TanStack Router)
  shared/         contratos zod (REST + eventos), aritmética de ETH, configuração
e2e/              testes Playwright, fixtures e baselines visuais
lighthouse/       configuração, runner e relatórios
docs/DESAFIO.md   enunciado original
```
