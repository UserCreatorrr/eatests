import { route } from '@/server/http/route'
import { getRecipe, recipeCost, recipeLines, recipeSchema, removeRecipe, updateRecipe } from '@/server/services/recipes'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx, params }) => {
  const id = Number(params.id)
  return { recipe: getRecipe(ctx, id), lines: recipeLines(ctx, id), cost: recipeCost(ctx, id) }
})

export const PATCH = route({ body: recipeSchema.partial() }, ({ ctx, params, body }) => updateRecipe(ctx, Number(params.id), body))

export const DELETE = route({}, ({ ctx, params }) => removeRecipe(ctx, Number(params.id)))
