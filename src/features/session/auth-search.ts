import { z } from 'zod'

/** Parâmetros de busca das rotas de login/cadastro (sem dependências de UI). */
export const authSearchSchema = z.object({
  redirect: z.string().max(500).optional().catch(undefined),
  motivo: z.enum(['expirada']).optional().catch(undefined),
})
