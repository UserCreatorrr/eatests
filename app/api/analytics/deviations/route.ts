import { route } from '@/server/http/route'
import { priceDeviations } from '@/server/services/analytics'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx }) => priceDeviations(ctx))
