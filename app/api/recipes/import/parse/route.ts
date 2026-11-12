import { route } from '@/server/http/route'
import { parseSchema, parseSheets } from '@/server/services/recipe-import'

export const dynamic = 'force-dynamic'

export const POST = route({ body: parseSchema }, ({ ctx, body }) => parseSheets(ctx, body))
