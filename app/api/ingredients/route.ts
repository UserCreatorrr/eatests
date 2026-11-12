import { z } from 'zod'
import { route } from '@/server/http/route'
import { createIngredient, ingredientSchema, listIngredients } from '@/server/services/catalog'

export const dynamic = 'force-dynamic'

export const GET = route({ query: z.object({ all: z.string().optional() }) }, ({ ctx, query }) => ({
  data: listIngredients(ctx, { includeInactive: query.all === '1' }),
}))

export const POST = route({ body: ingredientSchema }, ({ ctx, body }) => createIngredient(ctx, body))
