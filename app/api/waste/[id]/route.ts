import { route } from '@/server/http/route'
import { removeWaste } from '@/server/services/waste'

export const dynamic = 'force-dynamic'

export const DELETE = route({}, ({ ctx, params }) => { removeWaste(ctx, Number(params.id)); return { ok: true } })
