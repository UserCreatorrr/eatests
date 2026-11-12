import { z } from 'zod'
import { route } from '@/server/http/route'
import { setOrderStatus } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

const schema = z.object({ status: z.enum(['sent', 'closed', 'cancelled']), sentVia: z.enum(['email', 'whatsapp', 'manual']).optional() })

export const POST = route({ body: schema }, ({ ctx, params, body }) => setOrderStatus(ctx, Number(params.id), body.status, { sentVia: body.sentVia }))
