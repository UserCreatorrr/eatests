import { z } from 'zod'
import { route } from '@/server/http/route'
import { createTarget, listTargets, targetSchema } from '@/server/services/labor'

export const dynamic = 'force-dynamic'

export const GET = route({ query: z.object({ locationId: z.coerce.number().int().positive().optional() }) }, ({ ctx, query }) => ({ data: listTargets(ctx, query.locationId) }))
export const POST = route({ body: targetSchema }, ({ ctx, body }) => createTarget(ctx, body))
