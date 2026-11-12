import { route } from '@/server/http/route'
import { deactivateWarehouse } from '@/server/services/stock'

export const dynamic = 'force-dynamic'

export const DELETE = route({}, ({ ctx, params }) => { deactivateWarehouse(ctx, Number(params.id)); return { ok: true } })
