import { z } from 'zod'
import { route } from '@/server/http/route'
import { ingredientsToConsume, productionSchema, registerProduction } from '@/server/services/recipes'

export const dynamic = 'force-dynamic'

// Qué saldría del almacén al producir N raciones.
export const GET = route({ query: z.object({ portions: z.coerce.number().int().positive().default(1) }) },
  ({ ctx, params, query }) => ({ data: ingredientsToConsume(ctx, Number(params.id), query.portions ?? 1) }))

export const POST = route({ body: productionSchema.omit({ recipeId: true }) },
  ({ ctx, params, body }) => registerProduction(ctx, { ...body, recipeId: Number(params.id) }))
