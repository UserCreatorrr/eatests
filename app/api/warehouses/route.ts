import { route } from '@/server/http/route'
import { createWarehouse, listWarehouses, warehouseSchema } from '@/server/services/stock'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx }) => ({ data: listWarehouses(ctx) }))
export const POST = route({ body: warehouseSchema }, ({ ctx, body }) => createWarehouse(ctx, body))
