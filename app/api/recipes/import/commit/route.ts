import { route } from '@/server/http/route'
import { commitImport, commitSchema } from '@/server/services/recipe-import'

export const dynamic = 'force-dynamic'

export const POST = route({ body: commitSchema }, ({ ctx, body }) => commitImport(ctx, body))
