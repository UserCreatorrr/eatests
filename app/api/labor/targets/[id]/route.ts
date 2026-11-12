import { route } from '@/server/http/route'
import { removeTarget } from '@/server/services/labor'

export const dynamic = 'force-dynamic'

export const DELETE = route({}, ({ ctx, params }) => { removeTarget(ctx, Number(params.id)); return { ok: true } })
