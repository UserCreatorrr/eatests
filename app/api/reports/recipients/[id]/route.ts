import { route } from '@/server/http/route'
import { removeRecipient } from '@/server/services/reports'

export const dynamic = 'force-dynamic'

export const DELETE = route({}, ({ ctx, params }) => { removeRecipient(ctx, Number(params.id)); return { ok: true } })
