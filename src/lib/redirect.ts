/** Aceita apenas caminhos internos para evitar redirecionamento aberto. */
export function safeRedirect(target: string | undefined) {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : '/'
}
