import { z } from 'zod'
import { route } from '@/server/http/route'
import { createDeliveryNote, deliveryNoteSchema, listDeliveryNotes } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

const query = z.object({
  status: z.enum(['draft', 'review', 'validated', 'invoiced']).optional(),
  supplierId: z.coerce.number().int().positive().optional(),
  unbilled: z.string().optional(),
})

export const GET = route({ query }, ({ ctx, query }) => ({
  data: listDeliveryNotes(ctx, { status: query.status, supplierId: query.supplierId, unbilled: query.unbilled === '1' }),
}))

export const POST = route({ body: deliveryNoteSchema }, ({ ctx, body }) => createDeliveryNote(ctx, body))
