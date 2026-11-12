import { z } from 'zod'
import { parseDate, today } from '@/server/domain/dates'
import { ValidationError } from '@/server/domain/errors'
import { route } from '@/server/http/route'
import { priceHistory, recordPrice } from '@/server/services/catalog'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx, params }) => ({ data: priceHistory(ctx, Number(params.id), 100) }))

const schema = z.object({
  unitPrice: z.number().min(0).max(1e6),
  supplierId: z.number().int().positive().optional().nullable(),
  observedOn: z.string().optional().nullable(),
  apply: z.boolean().optional(),
})

// Precio registrado a mano (sin documento).
export const POST = route({ body: schema }, ({ ctx, params, body }) => {
  const on = body.observedOn ? parseDate(body.observedOn) : today()
  if (!on) throw new ValidationError('Fecha no válida')
  return recordPrice(ctx, { ingredientId: Number(params.id), supplierId: body.supplierId, unitPrice: body.unitPrice, observedOn: on, sourceType: 'manual', applyToIngredient: body.apply !== false })
})
