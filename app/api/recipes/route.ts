import { z } from 'zod'
import { route } from '@/server/http/route'
import { createRecipe, listRecipes, recipeCosts, recipeSchema } from '@/server/services/recipes'

export const dynamic = 'force-dynamic'

const query = z.object({ all: z.string().optional(), kind: z.enum(['dish', 'preparation']).optional() })

// Lista con el coste ya calculado por el motor (subrecetas y merma incluidas).
export const GET = route({ query }, ({ ctx, query }) => {
  const costs = recipeCosts(ctx)
  return {
    data: listRecipes(ctx, { includeInactive: query.all === '1', kind: query.kind }).map(r => {
      const c = costs.get(r.id)
      return { ...r, total: c?.total ?? 0, per_portion: c?.perPortion ?? 0, per_yield_unit: c?.perYieldUnit ?? null, food_cost_pct: c?.foodCostPct ?? null, incomplete: c?.incomplete ?? 0, cycle: c?.cycle ?? false }
    }),
  }
})

export const POST = route({ body: recipeSchema }, ({ ctx, body }) => createRecipe(ctx, body))
