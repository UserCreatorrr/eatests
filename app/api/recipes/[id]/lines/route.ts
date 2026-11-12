import { z } from 'zod'
import { route } from '@/server/http/route'
import { addLine, lineSchema, recipeCost, recipeLines, reorderLines } from '@/server/services/recipes'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx, params }) => ({ lines: recipeLines(ctx, Number(params.id)), cost: recipeCost(ctx, Number(params.id)) }))

export const POST = route({ body: lineSchema }, ({ ctx, params, body }) => {
  const id = Number(params.id)
  return { lines: addLine(ctx, id, body), cost: recipeCost(ctx, id) }
})

export const PATCH = route({ body: z.object({ order: z.array(z.number().int().positive()).min(1) }) }, ({ ctx, params, body }) => {
  reorderLines(ctx, Number(params.id), body.order); return { lines: recipeLines(ctx, Number(params.id)) }
})
