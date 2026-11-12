import { route } from '@/server/http/route'
import { getOrder } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx, params }) => getOrder(ctx, Number(params.id)))
