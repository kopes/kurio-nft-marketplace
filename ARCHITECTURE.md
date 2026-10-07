# Arquitetura

Este documento descreve as responsabilidades de cada camada, os contratos REST e de eventos, as políticas de sessão, carrinho, cache e reconciliação, a camada de mocks e as decisões de UX, acessibilidade e performance, incluindo os desvios em relação ao Figma.

## Visão geral

```
            ┌──────────────────────── Navegador ────────────────────────┐
 UI (React) │ routes/ → features/* → components/                        │
            │      │ useQuery / useMutation                              │
            │      ▼                                                     │
 Estado     │ TanStack Query (cache por usuário/escopo)  ◄── RealtimeBridge (aplica eventos no cache)
            │      │ endpoints.ts (contratos zod)              ▲         │
 Transporte │ Axios (http.ts: auth, carrinho visitante,  socket.io-client (1 socket por sessão)
            │        erros, expiração)                         │         │
            │      │ fetch/XHR                                 │ WebSocket
            ├──────┼───────────────────────────────────────────┼─────────┤
 Mocks      │ MSW Service Worker → handlers REST         ws.link + socket.io-binding
 (rede)     │                 └──── services (regras) ── db simulado (localStorage)
            └────────────────────────────────────────────────────────────┘
```

- **`src/shared/`**: contratos zod (REST e eventos), aritmética de ETH com `bigint` e configuração. Os mesmos tipos valem para o cliente e para a API simulada.
- **`src/api/`**: o único cliente HTTP (`http.ts`) e as funções por recurso (`endpoints.ts`). As respostas são validadas contra os contratos; uma resposta fora do contrato vira `ApiError('contract')`.
- **`src/features/`**: hooks de dados (queries e mutations), páginas e componentes de cada domínio. Componentes e hooks não contêm dados fictícios nem caminhos alternativos de negócio: tudo passa pela rede.
- **`src/mocks/`**: a API simulada (MSW), com banco, fixtures, cenários, regras de negócio e o servidor Socket.IO. É carregada sob demanda e só quando `VITE_ENABLE_MOCKS=true`.

## Rotas

| Rota | Tela | Acesso |
| --- | --- | --- |
| `/` | Início (hero, catálogo, destaques, diário) | público |
| `/mercado` | Catálogo completo com busca | público |
| `/nft/$nftId?edicao=` | Detalhe do NFT | público |
| `/carrinho` | Carrinho (visitante ou usuário) | público |
| `/entrar`, `/cadastro` `?redirect=&motivo=` | Login e cadastro (modal no desktop, tela cheia no mobile) | só visitante |
| `/pagamento` | Checkout | privado |
| `/pedido/$orderId` | Pedido pendente, recusado ou recibo confirmado | privado |
| `/pedido/$orderId/transacao` | Explorador de blocos simulado | privado |
| `/perfil`, `/perfil/carteiras`, `/perfil/favoritos` | Conta | privado |
| `/em-breve?secao=` | Seções editoriais fora do escopo | público |
| `*` | 404 | — |

- **Busca na URL:** os filtros do catálogo ficam nos search params (`q`, `colecoes`, `redes`, `precoMin`, `precoMax`, `aba`, `ordem`, `pagina`), validados com zod. Valores inválidos são descartados com `.catch()` e os padrões são removidos com `stripSearchParams`. Mudar qualquer filtro reinicia a paginação. A digitação usa `replace` (não polui o histórico); os demais filtros usam `push`, então o botão Voltar restaura o estado anterior.
- **Proteção:** o layout `/_auth` usa `beforeLoad` para redirecionar ao login com `redirect`, e o login devolve o usuário ao fluxo de origem (só caminhos internos são aceitos, evitando redirecionamento aberto).
- **Code splitting:** cada rota é um chunk lazy, exceto Início e Detalhe (as entradas mais comuns), que renderizam sem esperar um chunk extra.

## Contratos REST

Base `VITE_API_BASE_URL` (`/api`). Autenticação por `Authorization: Bearer <token>`. O carrinho de visitante é identificado por `X-Guest-Cart-Id`. Valores em ETH trafegam como **strings decimais** e quantidades são **inteiras**. Os schemas estão em [`src/shared/contracts.ts`](src/shared/contracts.ts).

### Envelope de erro

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Revise os campos destacados.", "fieldErrors": { "email": "Informe um e-mail válido" }, "details": {} } }
```

| HTTP | `code` | Uso |
| --- | --- | --- |
| 422 | `VALIDATION_ERROR`, `COUPON_INVALID`, `COUPON_EXPIRED` | Corpo inválido (com `fieldErrors`) e cupom. |
| 401 | `UNAUTHENTICATED`, `SESSION_EXPIRED`, `INVALID_CREDENTIALS` | Sessão ausente, expirada ou credenciais erradas. |
| 403 | `FORBIDDEN` | Recurso de outro usuário. |
| 404 | `NOT_FOUND` | Recurso inexistente. |
| 409 | `EMAIL_TAKEN`, `USERNAME_TAKEN`, `EDITION_UNAVAILABLE`, `OUT_OF_STOCK`, `QUANTITY_LIMIT`, `CART_EMPTY`, `QUOTE_CHANGED`, `IDEMPOTENCY_CONFLICT`, `WALLET_REJECTED`, `WALLET_DISCONNECTED`, `WALLET_ROLE_TAKEN` | Conflitos de disponibilidade, cotação e idempotência. |
| 500 / 503 | `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE` | Falha do servidor ou transitória. |

### Recursos

| Método | Caminho | Auth | Corpo | Resposta |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | — | `{ username, email, password, confirmPassword }` | 201 `Session` · 409 `EMAIL_TAKEN`/`USERNAME_TAKEN` · 422 |
| POST | `/auth/login` | — | `{ email, password }` | 200 `Session` · 401 `INVALID_CREDENTIALS` |
| GET | `/auth/session` | ✔ | — | 200 `{ expiresAt, user }` · 401 |
| POST | `/auth/logout` | ✔ | — | 204 |
| GET | `/nfts` | — | query `q, collections, networks, minPrice, maxPrice, tab, sort, page, pageSize, exclude` | 200 `NftListResponse` (itens, paginação e facetas com contagens) |
| GET | `/nfts/:id` | — | — | 200 `NftDetail` · 404 |
| GET | `/favorites` | ✔ | — | 200 `{ items: nftId[] }` |
| PUT / DELETE | `/favorites/:nftId` | ✔ | — | 200 `{ items }` · 404 |
| GET | `/cart` | visitante/✔ | — | 200 `Cart` |
| POST | `/cart/items` | visitante/✔ | `{ nftId, editionId, quantity }` | 201 `Cart` · 409 `EDITION_UNAVAILABLE`/`OUT_OF_STOCK`/`QUANTITY_LIMIT` |
| PATCH / DELETE | `/cart/items/:itemId` | visitante/✔ | `{ quantity }` / — | 200 `Cart` · 404 · 409 |
| POST / DELETE | `/cart/coupon` | visitante/✔ | `{ code }` / — | 200 `Cart` · 422 `COUPON_INVALID`/`COUPON_EXPIRED` |
| POST | `/cart/merge` | ✔ | `{ guestCartId }` | 200 `Cart` (itens do visitante limitados à disponibilidade) |
| GET | `/cart/quote?network=&context=` | visitante/✔ | — | 200 `Quote` (subtotal, desconto, cupom, taxa, total, `issues`, `id` = hash do conteúdo) |
| POST | `/orders` | ✔ + `Idempotency-Key` | `{ quoteId, walletConnectionId, collector }` | 201 `Order` (pendente) · 200 replay (`Idempotent-Replayed: true`) · 409 `QUOTE_CHANGED`/`OUT_OF_STOCK` (com `details.quote`) · 409 `IDEMPOTENCY_CONFLICT`/`WALLET_DISCONNECTED` |
| GET | `/orders?status=&idempotencyKey=` | ✔ | — | 200 `{ items: Order[] }` |
| GET | `/orders/:id` | ✔ | — | 200 `Order` · 403 · 404 |
| GET / PATCH | `/profile` | ✔ | `ProfileUpdateInput` | 200 `Profile` · 409 · 422 |
| PUT / DELETE | `/profile/avatar` | ✔ | `multipart/form-data` (`avatar`: PNG/JPG/WebP ≤ 1 MB) | 200 `Profile` · 422 |
| POST | `/profile/password` | ✔ | `{ currentPassword, newPassword, confirmPassword }` | 204 · 422 (`fieldErrors.currentPassword`) |
| GET / POST | `/wallets` | ✔ | `WalletInput` (`role: primary\|secondary`) | 200 `{ items }` / 201 `Wallet` · 409 `WALLET_ROLE_TAKEN` · 422 |
| PATCH | `/wallets/:id` | ✔ | `WalletInput` | 200 `Wallet` · 403 · 404 |
| POST / DELETE | `/wallet-connections[/:id]` | ✔ | `{ provider, network, address }` | 201 `WalletConnection` · 409 `WALLET_REJECTED` / 204 |

### Idempotência de pedidos

- O cliente gera uma chave por **tentativa** e a persiste (`localStorage`) junto com o hash do conteúdo. Cliques repetidos, reenvios após timeout e até um refresh reutilizam a mesma chave enquanto o conteúdo for o mesmo. Conteúdo diferente gera uma chave nova.
- O servidor associa `(usuário, chave)` ao hash do corpo: a mesma tentativa devolve o mesmo pedido (200), e a mesma chave com outro conteúdo devolve `409 IDEMPOTENCY_CONFLICT`.
- Falhas transitórias (timeout de 8 s, rede, 5xx) são repetidas automaticamente com a mesma chave, até 3 tentativas com backoff.

## Eventos em tempo real (Socket.IO)

Envelope comum: `{ id, type, resource: { type, id }, version, occurredAt, data }`.

| Evento | Destino | `data` |
| --- | --- | --- |
| `nft.updated` | Clientes inscritos em `nft:<id>` (ou `nft:*`) | `name, price, previousPrice, compareAtPrice, available, editions[{ id, available, status }], reason` (`price`, `availability`, `purchase`) |
| `order.updated` | Apenas o socket do dono (`userId` no envelope) | `status, declineReason, transaction` |
| `session.ready` | O socket que acabou de conectar | `{ authenticated }` (diagnóstico) |

Do cliente para o servidor: `subscribe` / `unsubscribe` com `{ topics: string[] }`.

### Garantias no cliente ([`realtime-client.ts`](src/features/realtime/realtime-client.ts))

- **Identidade por sessão:** o token vai no `auth` do handshake, com um socket por sessão. Logout ou troca de usuário destrói o socket anterior, junto com os listeners. Eventos `order.updated` com outro `userId` são descartados.
- **Duplicatas:** um conjunto LRU de ids já processados (500 entradas).
- **Ordem e versão:** a versão conhecida de cada recurso (`nft:<id>`, `order:<id>`) vem tanto dos eventos quanto das respostas REST (`observeVersion`). Eventos com versão menor ou igual são ignorados, e o patch no cache também só se aplica se `version` for maior.
- **Assinaturas com contagem de referências:** um tópico é assinado pelo primeiro componente que o usa e liberado (`unsubscribe`) quando o último desmonta. Na reconexão, todas são reenviadas.
- **Reconciliação:** depois de cada *re*conexão, as consultas ativas de catálogo, carrinho/cotação e pedidos são invalidadas, e o REST volta a ser a fonte da verdade. Pedidos pendentes também são revalidados a cada 5 s, como garantia caso eventos se percam.

### Aplicação no cache ([`realtime-bridge.tsx`](src/features/realtime/realtime-bridge.tsx))

- `nft.updated` corrige preço e disponibilidade no detalhe e em todas as listas em cache. Se o NFT está no carrinho, invalida carrinho e cotação, registra um aviso visível (carrinho e checkout) e anuncia a mudança em `aria-live`.
- `order.updated` atualiza o pedido em cache (o pendente vira confirmado ou recusado). A confirmação invalida o carrinho, porque a API remove apenas os itens comprados.

Os eventos nunca escrevem diretamente na UI: sempre passam pelo cache do TanStack Query.

### Transporte nos mocks e limitações

- O servidor é simulado com `ws.link` do MSW mais `@mswjs/socket.io-binding` ([`src/mocks/realtime.ts`](src/mocks/realtime.ts)). O cliente é o `socket.io-client` real, com transporte `websocket`.
- O MSW 2.15 remove o prefixo `/socket.io/` da URL do cliente antes de comparar, por isso o `ws.link` aponta para a raiz de `VITE_REALTIME_URL`.
- O binding só simula o handshake (pacotes `0` e `40`), então o próprio mock envia os pings do Engine.IO a cada 20 s.
- O pacote `CONNECT` (com `auth.token`) não passa pelos listeners do binding; ele é lido diretamente da conexão bruta.
- O `engine.io-client` captura o construtor `WebSocket` no carregamento do módulo. Por isso o `socket.io-client` é importado dinamicamente, só depois que o MSW instala a interceptação.
- Não há salas, namespaces nem broadcast entre abas: cada aba tem seu servidor simulado e seu banco, sincronizados apenas pelo `localStorage`. Os tópicos (`subscribe`) são implementados pelo próprio mock.
- `realtime.drop()` simula a queda do servidor, e o cliente reconecta com backoff (0,5 s a 4 s). No cenário `offline`, novas conexões são recusadas.

## Sessão

- `POST /auth/login` e `/auth/register` devolvem `{ token, expiresAt, user }`. O token é persistido (`kurio.session`) para recuperar a sessão após refresh, e sua validade é confirmada com `GET /auth/session` ao carregar a página.
- **Expiração:** um 401 `SESSION_EXPIRED` ou `UNAUTHENTICATED` referente ao token *ativo* (evitando corrida com um novo login) encerra a sessão e redireciona para `/entrar?redirect=<rota atual>&motivo=expirada`. Também há um timer que revalida a sessão quando `expiresAt` vence. No checkout, o rascunho do formulário (`sessionStorage`, por usuário) e o carrinho na API permitem retomar exatamente de onde o usuário parou.
- **Logout e troca de usuário:** remove do cache tudo o que fica em `['private', userId]` e o carrinho do usuário, limpa os avisos e recria o socket com a nova identidade. No logout explícito, o rascunho e a tentativa de pedido também são apagados.
- **Senhas:** o banco simulado guarda PBKDF2-SHA256 (WebCrypto) com salt por usuário, nunca a senha em claro.

## Carrinho

- O carrinho vive na API simulada, nunca só no cliente. O visitante tem um identificador próprio (`kurio.guest-cart-id`, enviado em `X-Guest-Cart-Id`); o usuário autenticado tem o carrinho dele.
- **Login:** `POST /cart/merge` une os itens do visitante ao carrinho do usuário, limitando cada um à disponibilidade e ao máximo por pedido da edição. Depois disso o identificador de visitante é renovado.
- Cada item informa `unitPrice` (atual), `previousUnitPrice` (quando o preço mudou desde que foi adicionado), `available`, `maxQuantity` e `issue` (`PRICE_CHANGED`, `INSUFFICIENT_STOCK`, `SOLD_OUT` ou `UNAVAILABLE`).
- **Cotação:** a API calcula subtotal, desconto, taxa de rede (que depende da rede) e total. O `id` da cotação é o hash do conteúdo; qualquer mudança gera outra cotação. A interface só exibe os valores da API e nunca recalcula o total.
- **Aritmética:** [`src/shared/eth.ts`](src/shared/eth.ts) converte para wei (`bigint`, 18 casas). Não há ponto flutuante em cálculo nem na exibição.
- **Pedido confirmado:** a API remove do carrinho apenas os itens e quantidades comprados. Se o pagamento falha, o carrinho fica intacto.

## Checkout e pedidos

1. O formulário é validado com zod (o mesmo schema da API). Os dados vêm pré-preenchidos do perfil e da carteira cadastrada escolhida; "Usar outra carteira?" libera a digitação manual.
2. A carteira é conectada (`POST /wallet-connections`, que pode ser recusada). Mudar provedor, rede ou endereço invalida a conexão.
3. A cotação é buscada de novo e a **revisão** é aberta. Se a cotação mudar durante a revisão (por um evento ou por um `409 QUOTE_CHANGED`/`OUT_OF_STOCK` com `details.quote`), a confirmação fica bloqueada até o usuário aceitar os novos valores; a revisão mostra a diferença item a item.
4. `POST /orders` com a chave de idempotência leva ao pedido **pendente** em `/pedido/:id`. Lá, o `order.updated` (ou o polling de garantia) leva ao estado terminal: **confirmado** (recibo) ou **recusado** (motivo, carrinho preservado e "Tentar novamente"). Estados terminais não mudam mais.
5. O **recibo** é o snapshot gravado no pedido (itens, preços, desconto, taxa, total, carteira e hash). Alterações posteriores no catálogo não afetam esses valores. A recuperação após refresh ou reconexão é natural, porque a URL contém o id do pedido. Enquanto houver um pedido pendente, o checkout mostra um aviso e não permite iniciar outra compra.

## Estratégia de cache, retries e sincronização

| Item | Política |
| --- | --- |
| `staleTime` / `gcTime` | 30 s / 5 min (cotação: 10 s; sessão: 60 s). |
| Retries | Até 2, com backoff exponencial (0,6 s a 4 s), **só** para falhas transitórias (rede, timeout, 5xx). Erros 4xx são definitivos. Mutations nunca são repetidas automaticamente; a criação de pedido tem sua própria lógica idempotente. |
| Respostas obsoletas | Cada chave inclui todos os parâmetros. O `AbortSignal` do Query cancela requisições cujos parâmetros mudaram, e `keepPreviousData` evita flicker enquanto a nova resposta não chega. |
| Isolamento | `['private', userId, ...]` para dados privados, `['cart', 'user:<id>' \| 'guest:<id>']` para carrinho e cotação, `['nfts', ...]` para o catálogo público. |
| Invalidação | As mutations do carrinho gravam o carrinho retornado e invalidam a cotação; perfil e carteiras gravam a resposta (e sincronizam o usuário da sessão); eventos fazem patch com versão ou invalidam; reconexões reconciliam. |
| Atualização otimista | **Favoritos** e **quantidade no carrinho**: aplicam na hora, revertem (rollback) e anunciam o erro em caso de falha. |
| Prefetch | Loaders das rotas fazem `prefetchQuery` sem bloquear, e o `defaultPreload: 'intent'` carrega antes do clique. |

## Camada de mocks (MSW)

- **Banco** ([`db.ts`](src/mocks/db.ts)): um estado único (usuários, sessões, NFTs, favoritos, carrinhos, carteiras, conexões, pedidos e contadores), persistido em `localStorage` e sincronizado entre abas pelo evento `storage`. Ids determinísticos (`ord_0001`), hashes derivados do conteúdo.
- **Fixtures** ([`fixtures/`](src/mocks/fixtures)): 42 NFTs gerados por PRNG com semente fixa. Os 8 primeiros reproduzem os cards do Figma, e o conjunto tem 9 coleções, 3 redes, preços de 0.02 a 12.30 ETH, edições esgotadas ou indisponíveis e avaliações. Inclui também 2 usuários, 2 carteiras e 3 cupons.
- **Regras** ([`services/`](src/mocks/services)): catálogo (filtros, facetas que excluem o próprio filtro, ordenação e paginação), carrinho, cotação, pedidos (liquidação, baixa de estoque, remoção parcial do carrinho) e alterações de NFT. Toda mudança de dados publica o evento correspondente, então o REST e o Socket.IO ficam sempre consistentes.
- **Condições de rede** ([`handlers/network.ts`](src/mocks/handlers/network.ts)): o primeiro handler da cadeia aplica a latência e as falhas do cenário (HTTP ou queda de conexão) e repassa a requisição ao handler do recurso.
- **Liquidação de pedidos:** feita por timers. Se a página recarregar, os pedidos pendentes vencidos são liquidados na próxima consulta e os demais são reagendados.
- Os mocks são carregados por import dinâmico, em paralelo à renderização (`modulepreload`); as requisições aguardam `mocksReady`. Componentes, hooks e o cliente Axios não sabem se a API é simulada.

## Acessibilidade

- HTML semântico: `header`, `nav`, `main`, `aside`, `article`, títulos hierárquicos (um `h1` por tela e viewport), tabelas e listas de definição no recibo e no detalhe.
- Link "Pular para o conteúdo". Ao navegar, o foco vai para o `main`. Foco visível com contorno de 2 px em todos os elementos interativos.
- Diálogos e drawers (Radix) prendem o foco, fecham com Esc e devolvem o foco ao gatilho.
- Formulários: `label` associado, `aria-required`, `aria-invalid` e mensagens de erro vinculadas por `aria-describedby` com `role="alert"`. Os erros da API são mapeados para os campos.
- Feedback de mutations e de eventos em tempo real por regiões `aria-live` (polite e assertive), além dos toasts.
- Estados não dependem só de cor: filtros ativos têm marcador e `aria-pressed`, edições indisponíveis vêm riscadas e com o texto "esgotada" ou "indisponível", erros têm ícone e texto, e há um rótulo "Esgotado" nos cards.
- `prefers-reduced-motion` desliga as transições, as entradas animadas (inclusive atrasos escalonados), a revelação ao rolar e a transição entre páginas, e troca o shimmer dos skeletons e o giro do anel de carregamento por um pulso de opacidade, sem movimento, que ainda indica o carregamento. Imagens relevantes têm texto alternativo descritivo; as decorativas usam `alt=""`.
- Carregamento: o `index.html` mostra um anel cobre (estilos inline) se o JavaScript demorar mais de 300 ms, o router usa o mesmo anel quando o código de uma rota demora mais de 200 ms, e as artes dos NFTs exibem shimmer até a imagem carregar.
- **Ajustes em relação ao layout** (para atingir o contraste do WCAG):
  - Borda dos campos: `#3F2319` → `#86603F` (contraste de 3,4:1 com o fundo, WCAG 1.4.11).
  - Cor de erro: `#ED1B2E` (4,0:1 sobre `#241612`) → coral `#F0805F` (6,6:1).
  - Rótulos visualmente ocultos onde o Figma não mostra rótulo (ex.: "ENS ou carteira secundária"), preservando o alinhamento.

## Performance e Lighthouse

### Otimizações

- Artes convertidas de PNG (cerca de 2 MB cada) para **WebP responsivo** (240, 480, 720 e 960 px; cerca de 450 KB no total), com `srcset`/`sizes`, dimensões explícitas (sem CLS) e preload da arte do hero.
- **App shell estático** no `index.html` (cabeçalho no desktop e barra inferior no mobile, com as mesmas classes e ícones), pintado antes do JS e substituído no primeiro render.
- O Início e o Detalhe não são divididos em chunks lazy. As dependências ficam agrupadas por domínio (`react`, `tanstack`, `radix`, `zod`), o que reduziu o carregamento inicial de 36 para 17 requisições.
- As definições de rota não importam módulos de UI (ex.: `safeRedirect` e o schema de login ficam em módulos leves).
- `modulepreload` do chunk de mocks, injetado por um plugin de build, para que ele baixe em paralelo ao bundle principal.
- `tldts` (a lista de sufixos públicos, dependência transitiva do `tough-cookie` usado pelo MSW) é substituído por um **shim mínimo** ([`src/mocks/lib/tldts-shim.ts`](src/mocks/lib/tldts-shim.ts)). A API simulada não usa cookies, e o chunk de mocks caiu de 176 KB para 64 KB gzip.
- Fontes self-hosted (Fontsource, apenas o subset latino em 400, 500 e 700, com `font-display: swap`). Skeletons reservam o espaço do conteúdo final, inclusive das abas e do carrossel do detalhe (o CLS do detalhe desktop caiu de 0,228 para 0,022).

### Resultados (mediana de 3 execuções)

| Página | Perfil | Perf. | A11y | BP | SEO | LCP | CLS | TBT |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Início | mobile | 79 | 100 | 100 | 100 | 4120 ms | 0.021 | 198 ms |
| Início | desktop | 99 | 100 | 100 | 100 | 758 ms | 0 | 0 ms |
| Detalhe | mobile | 83 | 100 | 100 | 100 | 3684 ms | 0 | 119 ms |
| Detalhe | desktop | 99 | 100 | 100 | 100 | 813 ms | 0.022 | 0 ms |

Os relatórios HTML/JSON de cada execução, as versões das ferramentas e o ambiente estão em [`lighthouse/reports/`](lighthouse/reports/summary.md).

### Por que a Performance mobile fica abaixo de 90

O LCP do Início (primeiro card do catálogo) e do Detalhe (arte principal) é uma imagem que **depende da resposta da API**. No build de demonstração, essa resposta só existe depois que:

1. o bundle principal (cerca de 250 KB gzip) e o chunk de mocks (64 KB gzip) são baixados sob o throttling de 4G lento do Lighthouse (cerca de 1,6 Mbps, RTT de 150 ms);
2. o MSW registra e ativa o Service Worker. A auditoria sempre parte de um perfil limpo, sem SW instalado;
3. a API simulada responde com a latência do cenário padrão (180 ms), e só então a imagem é requisitada.

O FCP (2,1 a 2,7 s) também é penalizado porque a estimativa do Lighthouse inclui os `modulepreload` iniciados antes da primeira pintura. TBT e CLS estão dentro da meta. No desktop, os mesmos fluxos ficam em 99. Em produção com uma API real, os passos 1 (chunk de mocks) e 2 deixariam de existir. A auditoria foi mantida fiel à entrega: mocks ativos e imagens, fontes e funcionalidades completas, sem atalhos exclusivos para a pontuação.

## Desvios do Figma e decisões de UX

| Item | Decisão |
| --- | --- |
| Criadores, Aprenda, Diário, Central de ajuda, Atividade, Ofertas, Arquivos, Suporte | Fora do escopo: levam a `/em-breve`, que deixa isso claro, e os itens da barra do perfil têm o selo "Em breve". |
| Login social e "Esqueceu a senha?" | Mostram que o recurso não está disponível na demonstração, sem simular sucesso. |
| Newsletter do rodapé | Informa que a inscrição não está disponível, sem aparentar sucesso funcional. |
| Revisão do pedido | Diálogo que não está no Figma, necessário para "revisão antes do envio" e para a nova confirmação quando os valores mudam. Segue o padrão visual do recibo. |
| Pedido pendente e recusado | Estados não desenhados, no mesmo cartão do recibo. |
| "Ver no Etherscan" | Abre um explorador **simulado** (`/pedido/:id/transacao`), já que hash e rede são fictícios. |
| Carteira e rede (checkout) | A 1ª opção do Figma (selo com as três marcas) é interpretada como WalletConnect. As carteiras cadastradas aparecem como no frame mobile ("Carteira conectada"). |
| Pagamento no mobile | Os dados do colecionador, já pré-preenchidos, ficam num bloco expansível para seguir o frame mobile (carteiras, rede, total e confirmar); ele abre sozinho se houver erro. |
| Carrinho no mobile | Segue o frame: cards de item com seletor discreto e resumo num card preso ao rodapé (cupom em pílula, sem título visível nem navegação inferior). O frame não tem um controle de remoção (só uma lixeira sobreposta ao "+" do 3º item), então, na quantidade mínima ou com a edição esgotada, o "−" vira a lixeira. Os botões do seletor têm 24 px (22 px no frame) para atingir a área mínima de toque. As sugestões, o aviso para visitantes e "Continuar explorando" ficam só no desktop; com o carrinho vazio, o card some e as sugestões aparecem. |
| Detalhe do NFT no mobile | Segue o frame (hero em gradiente, folha de detalhes sobre a arte, selo de nota e barra de compra fixa sem a navegação inferior). Não estão no frame: a lupa (tocar na arte abre o zoom), o compartilhamento (só desktop) e as abas e "Mais desta coleção", que vêm abaixo da folha. O preço anterior riscado aparece na barra quando há desconto. |
| Sufixo ENS ".eth" | Exibido como prefixo estático: o Figma sugere um seletor, mas só há uma opção. |
| Contagens do catálogo | Refletem as fixtures (42 NFTs) e vêm da API como facetas, em vez dos números ilustrativos do Figma. |
| Resultados e chips de filtro | A partir do tablet, há uma linha extra com o total de resultados e os filtros ativos removíveis, para dar feedback acessível. No mobile (o frame não tem esses elementos), o total é só anunciado a leitores de tela e o número de filtros ativos aparece no botão de filtros. |
| Início no mobile | Segue o frame "Mobile / Início": busca antes do hero; hero com raio de 30 px, gradiente e os dois círculos do Figma, com a miniatura sobreposta à arte; abas com 4 px e 16 px de espaçamento; grade em "escadinha" (coluna direita 32 px abaixo, por `translate`, para manter a ordem de leitura); cards de 175×200 com favorito circular. A ordenação, que não aparece no frame, fica no drawer de filtros. |
| Barra de abas no mobile | Recorte central desenhado com o vetor do Figma (recalculado para a largura da tela), botão central em gradiente com o ícone de "scan" e ícones sólidos. Assim como nos frames, ela não aparece no detalhe, carrinho, pagamento, login e cadastro, que têm ações próprias e o botão Voltar. |
| Lista de interesse | Implementada como a página de favoritos. |
| Ícones | Exportados do Figma (Iconly, ícones sólidos da barra mobile, "scan" e logos) como componentes SVG. Os ícones sem equivalente no arquivo (olho para mostrar a senha, menos e mais) vêm do `lucide-react`. |
| Tipografia | Roboto Mono, igual ao Figma, servida localmente. |
| Movimento e transições | Não estão no Figma; o estado de repouso de cada tela continua igual ao layout (as baselines visuais não mudaram). Trocas de página usam View Transitions só quando o caminho muda (não no carregamento inicial nem em filtros); cabeçalho e barra inferior ficam parados e o indicador da navegação desliza. O conteúdo entra em cascata, os cards sobem no hover e a arte amplia dentro da moldura, imagens vindas da rede saem do desfoque (as prioritárias/LCP aparecem direto), e contadores e favoritos "saltam" ao mudar. A partir do tablet o cabeçalho é fixo e ganha fundo translúcido ao rolar (`scroll-padding-top` evita que cubra âncoras e foco). Tudo é CSS (`tw-animate-css` + keyframes próprios em `globals.css`), sem biblioteca de animação. As entradas usam `animation-fill-mode: backwards`, para não segurar `transform` depois de terminar, e elementos com filhos `fixed` (ex.: barra de compra) não recebem `transform`. |

## Limitações conhecidas

- O estado simulado vive no navegador (`localStorage`). Abas diferentes compartilham os dados, mas não um servidor de tempo real comum, então eventos não atravessam abas.
- No primeiro acesso, o Service Worker do MSW precisa ser registrado antes das requisições; a interface aparece antes, com skeletons.
- As baselines visuais dependem da plataforma (as atuais são de `win32`); em outro sistema operacional, gere novas com `pnpm test:e2e:update`.
- As medições do Lighthouse foram feitas localmente com `vite preview` (HTTP/1.1). Em uma CDN com HTTP/2 a tendência é de números melhores.
