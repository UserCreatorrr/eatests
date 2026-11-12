import { z } from 'zod'
import { route } from '@/server/http/route'
import { validateDeliveryNote } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

// Validar: precios, histórico, stock y recetas afectadas, todo o nada.
export const POST = route({ body: z.object({ applyPrices: z.boolean().optional(), force: z.boolean().optional() }).optional() },
  ({ ctx, params, body }) => validateDeliveryNote(ctx, Number(params.id), body ?? {}))
