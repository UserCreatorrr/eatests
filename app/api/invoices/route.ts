import { z } from 'zod'
import { route } from '@/server/http/route'
import { createInvoice, invoiceSchema, listInvoices } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

const query = z.object({ status: z.enum(['pending', 'paid']).optional(), supplierId: z.coerce.number().int().positive().optional(), dueBefore: z.string().optional() })

export const GET = route({ query }, ({ ctx, query }) => ({ data: listInvoices(ctx, query) }))

export const POST = route({ body: invoiceSchema }, ({ ctx, body }) => createInvoice(ctx, body))
