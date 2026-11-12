import { z } from 'zod'
import { route } from '@/server/http/route'
import { createSupplier, listSuppliers, supplierSchema } from '@/server/services/catalog'

export const dynamic = 'force-dynamic'

export const GET = route({ query: z.object({ all: z.string().optional() }) }, ({ ctx, query }) => ({
  data: listSuppliers(ctx, { includeInactive: query.all === '1' }),
}))

export const POST = route({ body: supplierSchema }, ({ ctx, body }) => createSupplier(ctx, body))
