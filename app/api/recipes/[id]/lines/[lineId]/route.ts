import { route } from '@/server/http/route'
import { lineSchema, recipeCost, removeLine, updateLine } from '@/server/services/recipes'

export const dynamic = 'force-dynamic'

export const PATCH = route({ body: lineSchema.partial() }, ({ ctx, params, body }) => {
  const id = Number(params.id)
  return { lines: updateLine(ctx, id, Number(params.lineId), body), cost: recipeCost(ctx, id) }
})

export const DELETE = route({}, ({ ctx, params }) => {
  const id = Number(params.id)
  removeLine(ctx, id, Number(params.lineId))
  return { cost: recipeCost(ctx, id) }
})
