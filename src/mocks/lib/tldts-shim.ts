/**
 * Substituto mínimo de `tldts` para o bundle do navegador.
 *
 * `tldts` (lista completa de sufixos públicos, ~60 KB gzip) é dependência transitiva de
 * `tough-cookie`, usado pelo MSW para cookies. A API simulada não usa cookies, então basta
 * uma aproximação do domínio registrável (dois últimos rótulos).
 */
export function getDomain(hostname: string): string | null {
  const labels = hostname.split('.').filter(Boolean)
  if (labels.length === 0) return null
  return labels.slice(-2).join('.')
}
