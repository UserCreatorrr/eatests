import { z } from 'zod'
import { route } from '@/server/http/route'
import { setInvoicePaid } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

export const POST = route({ body: z.object({ paid: z.boolean(), paidOn: z.string().optional().nullable() }) },
  ({ ctx, params, body }) => setInvoicePaid(ctx, Number(params.id), body.paid, body.paidOn))
