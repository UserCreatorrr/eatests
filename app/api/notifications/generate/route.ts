import { route } from '@/server/http/route'
import { generateFromAlerts } from '@/server/services/notifications'

export const dynamic = 'force-dynamic'

export const POST = route({}, async ({ ctx }) => ({ generated: await generateFromAlerts(ctx) }))
