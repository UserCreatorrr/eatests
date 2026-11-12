import { z } from 'zod'
import { route } from '@/server/http/route'
import { movements } from '@/server/services/stock'

export const dynamic = 'force-dynamic'

export const GET = route({ query: z.object({ ingredientId: z.coerce.number().int().positive() }) }, ({ ctx, query }) => ({ data: movements(ctx, query.ingredientId, 200) }))
