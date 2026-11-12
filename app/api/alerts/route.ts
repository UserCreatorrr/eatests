import { route } from '@/server/http/route'
import { computeAlerts } from '@/server/services/alerts'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx }) => ({ alerts: computeAlerts(ctx) }))
