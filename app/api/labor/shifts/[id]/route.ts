import { route } from '@/server/http/route'
import { removeShift, shiftSchema, updateShift } from '@/server/services/labor'

export const dynamic = 'force-dynamic'

export const PATCH = route({ body: shiftSchema.partial() }, ({ ctx, params, body }) => updateShift(ctx, Number(params.id), body))
export const DELETE = route({}, ({ ctx, params }) => { removeShift(ctx, Number(params.id)); return { ok: true } })
