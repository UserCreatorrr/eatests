import { route } from '@/server/http/route'
import { dashboard } from '@/server/services/analytics'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx }) => dashboard(ctx))
