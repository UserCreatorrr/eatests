import { z } from 'zod'
import { route } from '@/server/http/route'
import { receiveOrder } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

// Recibir el pedido: nace el albarán en borrador con las líneas rellenas.
export const POST = route({ body: z.object({ number: z.string().trim().max(60).optional().nullable(), deliveryDate: z.string().optional().nullable() }).optional() },
  ({ ctx, params, body }) => receiveOrder(ctx, Number(params.id), body ?? {}))
