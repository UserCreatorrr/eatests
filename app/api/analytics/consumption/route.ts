import { z } from 'zod'
import { route } from '@/server/http/route'
import { consumption } from '@/server/services/analytics'

export const dynamic = 'force-dynamic'

export const GET = route({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }) }, ({ ctx, query }) => consumption(ctx, query.month))
