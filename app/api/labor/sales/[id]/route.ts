import { route } from '@/server/http/route'
import { removeSalesSlot } from '@/server/services/labor'

export const dynamic = 'force-dynamic'

export const DELETE = route({}, ({ ctx, params }) => { removeSalesSlot(ctx, Number(params.id)); return { ok: true } })
