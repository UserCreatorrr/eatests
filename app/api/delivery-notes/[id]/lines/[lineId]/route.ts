import { route } from '@/server/http/route'
import { deliveryNoteLineSchema, removeDeliveryNoteLine, updateDeliveryNoteLine } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

export const PATCH = route({ body: deliveryNoteLineSchema.partial() }, ({ ctx, params, body }) => ({ lines: updateDeliveryNoteLine(ctx, Number(params.id), Number(params.lineId), body) }))

export const DELETE = route({}, ({ ctx, params }) => { removeDeliveryNoteLine(ctx, Number(params.id), Number(params.lineId)); return { ok: true } })
