import { z } from 'zod'
import { route } from '@/server/http/route'
import { attachDeliveryNotes } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

export const POST = route({ body: z.object({ deliveryNoteIds: z.array(z.number().int().positive()).min(1) }) },
  ({ ctx, params, body }) => attachDeliveryNotes(ctx, Number(params.id), body.deliveryNoteIds))
