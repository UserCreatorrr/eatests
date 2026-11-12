import { openaiVision } from '@/server/adapters/openai'
import { clientIp, route } from '@/server/http/route'
import { rateLimit } from '@/server/http/ratelimit'
import { scanDocument, scanSchema } from '@/server/services/documents'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

// Lee el documento y lo cruza con el catalogo. No guarda nada: eso es /commit.
export const POST = route({ body: scanSchema }, ({ ctx, body, req }) => {
  rateLimit(`scan:${ctx.orgId}:${clientIp(req)}`, 30, 600_000, 'Demasiados escaneos seguidos. Espera unos minutos')
  return scanDocument(ctx, body, openaiVision)
})
