import { z } from 'zod'
import { route } from '@/server/http/route'
import { createSalesDoc, listSalesDocs, salesDocSchema } from '@/server/services/sales'

export const dynamic = 'force-dynamic'

export const GET = route({ query: z.object({ kind: z.enum(['delivery_note', 'invoice']).optional() }) }, ({ ctx, query }) => ({ data: listSalesDocs(ctx, query.kind) }))
export const POST = route({ body: salesDocSchema }, ({ ctx, body }) => createSalesDoc(ctx, body))
