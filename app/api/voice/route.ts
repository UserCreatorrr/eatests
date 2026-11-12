import { openaiTranscribe } from '@/server/adapters/openai'
import { ValidationError } from '@/server/domain/errors'
import { route } from '@/server/http/route'
import { rateLimit } from '@/server/http/ratelimit'

export const dynamic = 'force-dynamic'

export const POST = route({}, async ({ ctx, req }) => {
  rateLimit(`voice:${ctx.userId}`, 20, 60_000, 'Demasiadas transcripciones seguidas')
  const form = await req.formData()
  const audio = form.get('audio')
  if (!(audio instanceof File) || audio.size === 0) throw new ValidationError('No llega audio')
  if (audio.size > 10_000_000) throw new ValidationError('El audio supera los 10 MB')
  return { text: await openaiTranscribe(audio) }
})
