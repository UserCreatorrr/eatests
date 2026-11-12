import { z } from 'zod'
import { route } from '@/server/http/route'
import { createShift, listShifts, shiftSchema } from '@/server/services/labor'

export const dynamic = 'force-dynamic'

export const GET = route({ query: z.object({ from: z.string().optional(), to: z.string().optional(), locationId: z.coerce.number().int().positive().optional() }) }, ({ ctx, query }) => ({ data: listShifts(ctx, query) }))
export const POST = route({ body: shiftSchema }, ({ ctx, body }) => createShift(ctx, body))
