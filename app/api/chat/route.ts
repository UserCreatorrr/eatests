import { z } from 'zod'
import { openaiLlm } from '@/server/adapters/openai'
import { route } from '@/server/http/route'
import { rateLimit } from '@/server/http/ratelimit'
import { runAssistant } from '@/server/services/assistant'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) })).min(1).max(40),
  image: z.string().max(12_000_000).optional().nullable(),
})

export const POST = route({ body: schema }, ({ ctx, body }) => {
  rateLimit(`chat:${ctx.userId}`, 30, 60_000, 'Vas muy rápido. Espera unos segundos e inténtalo de nuevo')
  return runAssistant(ctx, body, openaiLlm)
})
