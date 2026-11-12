import { route } from '@/server/http/route'
import { removeOrderLine } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

export const DELETE = route({}, ({ ctx, params }) => { removeOrderLine(ctx, Number(params.id), Number(params.lineId)); return { ok: true } })
