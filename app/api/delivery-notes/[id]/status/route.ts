import { z } from 'zod'
import { route } from '@/server/http/route'
import { setDeliveryNoteStatus } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

export const POST = route({ body: z.object({ status: z.enum(['draft', 'review']) }) }, ({ ctx, params, body }) => setDeliveryNoteStatus(ctx, Number(params.id), body.status))
