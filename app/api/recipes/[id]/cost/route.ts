import { route } from '@/server/http/route'
import { recipeCost } from '@/server/services/recipes'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx, params }) => recipeCost(ctx, Number(params.id)))
