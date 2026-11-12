import { route } from '@/server/http/route'
import { listNotifications } from '@/server/services/notifications'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx }) => listNotifications(ctx))
