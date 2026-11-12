import { route } from '@/server/http/route'
import { briefQuerySchema, dailyBrief } from '@/server/services/reports'

export const dynamic = 'force-dynamic'

export const GET = route({ query: briefQuerySchema }, ({ ctx, query }) => dailyBrief(ctx, query))
