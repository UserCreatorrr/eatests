import { route } from '@/server/http/route'
import { addDeliveryNoteLine, deliveryNoteLineSchema } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

export const POST = route({ body: deliveryNoteLineSchema }, ({ ctx, params, body }) => ({ lines: addDeliveryNoteLine(ctx, Number(params.id), body) }))
