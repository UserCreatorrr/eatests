import { route } from '@/server/http/route'
import { adjustmentSchema, registerAdjustment } from '@/server/services/stock'

export const dynamic = 'force-dynamic'

export const POST = route({ body: adjustmentSchema }, ({ ctx, body }) => { registerAdjustment(ctx, body); return { ok: true } })
