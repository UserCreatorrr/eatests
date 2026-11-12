import { route } from '@/server/http/route'
import { getIngredient, ingredientSchema, recipesUsingIngredient, removeIngredient, updateIngredient, priceHistory } from '@/server/services/catalog'
import { recipeCosts } from '@/server/services/recipes'
import { movements, stockLevels } from '@/server/services/stock'

export const dynamic = 'force-dynamic'

// Ficha viva: quién me lo vende, a qué precio, dónde está, en qué recetas va.
export const GET = route({}, ({ ctx, params }) => {
  const id = Number(params.id)
  const ingredient = getIngredient(ctx, id)
  const recipes = recipesUsingIngredient(ctx, id)
  const costs = recipeCosts(ctx)
  const usage = recipes.map(r => {
    const c = costs.get(r.id)
    const line = c?.lines.find(l => l.kind === 'ingredient' && l.name === ingredient.name)
    return { id: r.id, name: r.name, kind: c?.kind, perPortionContribution: c && line ? Math.round((line.cost / (c.lines.length ? 1 : 1)) / (c.perPortion > 0 ? (c.total / c.perPortion) : 1) * 10000) / 10000 : null,
             lineQty: line?.qty ?? null, lineUnit: line?.unit ?? null, foodCostPct: c?.foodCostPct ?? null, salePrice: c?.salePrice ?? null }
  })
  const purchases = ctx.db.prepare(`SELECT l.id, d.delivery_date AS date, d.number, s.name AS supplier, l.qty, l.unit, l.unit_price, l.previous_unit_price, l.line_total_cents, d.id AS delivery_note_id, d.status
                                    FROM delivery_note_lines l JOIN delivery_notes d ON d.id = l.delivery_note_id JOIN suppliers s ON s.id = d.supplier_id
                                    WHERE l.org_id = ? AND l.ingredient_id = ? ORDER BY d.delivery_date DESC, l.id DESC LIMIT 25`).all(ctx.orgId, id)
  const waste = ctx.db.prepare('SELECT id, occurred_on, qty, unit, reason, estimated_cost FROM waste_records WHERE org_id = ? AND ingredient_id = ? ORDER BY occurred_on DESC LIMIT 20').all(ctx.orgId, id)
  return { ingredient, usage, purchases, prices: priceHistory(ctx, id, 30), waste, stock: stockLevels(ctx, { ingredientId: id }), movements: movements(ctx, id, 30) }
})

export const PATCH = route({ body: ingredientSchema.partial() }, ({ ctx, params, body }) => {
  const id = Number(params.id)
  // Cambiar la unidad base recalcula las recetas que lo usan: se devuelve el impacto.
  const before = getIngredient(ctx, id)
  const after = updateIngredient(ctx, id, body)
  const affected = before.base_unit !== after.base_unit ? recipesUsingIngredient(ctx, id) : []
  return { ...after, affectedRecipes: affected }
})

export const DELETE = route({}, ({ ctx, params }) => removeIngredient(ctx, Number(params.id)))
