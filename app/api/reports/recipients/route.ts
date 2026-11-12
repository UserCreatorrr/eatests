import { route } from '@/server/http/route'
import { createRecipient, listRecipients, recipientSchema } from '@/server/services/reports'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx }) => ({ data: listRecipients(ctx) }))
export const POST = route({ body: recipientSchema }, ({ ctx, body }) => createRecipient(ctx, body))
