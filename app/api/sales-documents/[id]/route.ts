import { route } from '@/server/http/route'
import { removeSalesDoc, salesDocSchema, updateSalesDoc } from '@/server/services/sales'

export const dynamic = 'force-dynamic'

export const PATCH = route({ body: salesDocSchema.partial() }, ({ ctx, params, body }) => updateSalesDoc(ctx, Number(params.id), body))
export const DELETE = route({}, ({ ctx, params }) => { removeSalesDoc(ctx, Number(params.id)); return { ok: true } })
