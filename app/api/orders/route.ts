import { z } from 'zod'
import { route } from '@/server/http/route'
import { createOrder, listOrders, orderSchema } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

export const GET = route({ query: z.object({ status: z.enum(['draft', 'sent', 'received', 'closed', 'cancelled']).optional() }) }, ({ ctx, query }) => ({
  data: listOrders(ctx, { status: query.status }),
}))

export const POST = route({ body: orderSchema }, ({ ctx, body }) => createOrder(ctx, body))
