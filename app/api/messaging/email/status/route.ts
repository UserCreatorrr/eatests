import { route } from '@/server/http/route'
import { gmailConfigured } from '@/server/services/messaging'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx }) => ({ configured: gmailConfigured(ctx.db) }))
