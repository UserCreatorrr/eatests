import { route } from '@/server/http/route'
import { addOrderLine, orderLineSchema } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

export const POST = route({ body: orderLineSchema }, ({ ctx, params, body }) => ({ lines: addOrderLine(ctx, Number(params.id), body) }))
