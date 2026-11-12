import { z } from 'zod'
import { route } from '@/server/http/route'
import { createSalesSlot, listSalesSlots, salesSlotSchema } from '@/server/services/labor'

export const dynamic = 'force-dynamic'

export const GET = route({ query: z.object({ from: z.string().optional(), to: z.string().optional(), locationId: z.coerce.number().int().positive().optional() }) }, ({ ctx, query }) => ({ data: listSalesSlots(ctx, query) }))
export const POST = route({ body: salesSlotSchema }, ({ ctx, body }) => createSalesSlot(ctx, body))
