import { route } from '@/server/http/route'
import { markRead } from '@/server/services/notifications'

export const dynamic = 'force-dynamic'

export const PATCH = route({}, ({ ctx, params }) => { markRead(ctx, Number(params.id)); return { ok: true } })
