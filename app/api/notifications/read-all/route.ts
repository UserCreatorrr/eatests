import { route } from '@/server/http/route'
import { markAllRead } from '@/server/services/notifications'

export const dynamic = 'force-dynamic'

export const PATCH = route({}, ({ ctx }) => ({ updated: markAllRead(ctx) }))
