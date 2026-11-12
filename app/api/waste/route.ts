import { z } from 'zod'
import { route } from '@/server/http/route'
import { listWaste, registerWaste, wasteSchema, wasteStats } from '@/server/services/waste'

export const dynamic = 'force-dynamic'

const query = z.object({ from: z.string().optional(), to: z.string().optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional() })

export const GET = route({ query }, ({ ctx, query }) => ({ data: listWaste(ctx, query), stats: wasteStats(ctx, query.month) }))
export const POST = route({ body: wasteSchema }, ({ ctx, body }) => registerWaste(ctx, body))
