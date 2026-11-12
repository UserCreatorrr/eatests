import { route } from '@/server/http/route'
import { commitDocument, commitSchema } from '@/server/services/documents'

export const dynamic = 'force-dynamic'

export const POST = route({ body: commitSchema }, ({ ctx, body }) => commitDocument(ctx, body))
