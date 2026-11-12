import { route } from '@/server/http/route'
import { countSchema, registerCount } from '@/server/services/stock'

export const dynamic = 'force-dynamic'

// Recuento físico: la desviación con el teórico queda como movimiento.
export const POST = route({ body: countSchema }, ({ ctx, body }) => ({ results: registerCount(ctx, body) }))
