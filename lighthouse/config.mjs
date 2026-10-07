/** Configuração versionada da auditoria Lighthouse (ver lighthouse/run.mjs). */
export const config = {
  port: 4174,
  runs: 3,
  categories: ['performance', 'accessibility', 'best-practices', 'seo'],
  profiles: ['mobile', 'desktop'],
  pages: [
    { id: 'inicio', path: '/' },
    { id: 'detalhe', path: '/nft/emerald-ape-042' },
  ],
  targets: { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 },
}
