// Merma: registros con coste estimado a partir del ingrediente (en su unidad
// base) o de la receta (coste por ración). Opcionalmente descuenta stock.
import { z } from 'zod'
import { parseDate, today } from '@/server/domain/dates'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import { round2 } from '@/server/domain/money'
import { compatible, conversionFactor, parseUnit } from '@/server/domain/units'
import type { Ctx } from '@/server/http/context'
import { findIngredientByName, getIngredient } from './catalog'
import { getRecipe, recipeCost } from './recipes'
import { registerOutflow } from './stock'

const unitField = z.string().transform((v, c) => { const u = parseUnit(v); if (!u) { c.addIssue({ code: 'custom', message: `Unidad no válida: ${v}` }); return z.NEVER } return u })

export const wasteSchema = z.object({
  kind: z.enum(['ingredient', 'dish']).optional(),
  ingredientId: z.number().int().positive().optional().nullable(),
  recipeId: z.number().int().positive().optional().nullable(),
  description: z.string().trim().max(160).optional().nullable(),
  qty: z.number().positive('La cantidad debe ser mayor que 0').max(1e6),
  unit: unitField,
  reason: z.string().trim().max(80).optional().nullable(),
  estimatedCost: z.number().min(0).optional().nullable(),
  occurredOn: z.string().optional().nullable(),
  locationId: z.number().int().positive().optional().nullable(),
  warehouseId: z.number().int().positive().optional().nullable(),
  service: z.string().trim().max(60).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  /** Descontar del stock (solo merma de ingrediente con stock llevado). */
  consumeStock: z.boolean().optional(),
})

export interface WasteRecord {
  id: number; kind: 'ingredient' | 'dish'; ingredient_id: number | null; recipe_id: number | null; description: string; qty: number; unit: string
  reason: string | null; estimated_cost: number | null; occurred_on: string; location_id: number | null; warehouse_id: number | null; service: string | null; notes: string | null
}

const SEL = 'SELECT id, kind, ingredient_id, recipe_id, description, qty, unit, reason, estimated_cost, occurred_on, location_id, warehouse_id, service, notes FROM waste_records'

export function listWaste(ctx: Ctx, opts: { from?: string | null; to?: string | null; limit?: number } = {}): WasteRecord[] {
  const parts: string[] = [], params: (string | number)[] = [ctx.orgId]
  if (opts.from) { parts.push('occurred_on >= ?'); params.push(opts.from) }
  if (opts.to) { parts.push('occurred_on <= ?'); params.push(opts.to) }
  params.push(opts.limit ?? 200)
  return ctx.db.prepare(`${SEL} WHERE org_id = ? ${parts.length ? 'AND ' + parts.join(' AND ') : ''} ORDER BY occurred_on DESC, id DESC LIMIT ?`).all(...params) as WasteRecord[]
}

export function wasteStats(ctx: Ctx, month = today().slice(0, 7)) {
  const byReason = ctx.db.prepare(`SELECT COALESCE(reason, 'Sin motivo') AS reason, COUNT(*) AS n, ROUND(COALESCE(SUM(estimated_cost), 0), 2) AS cost FROM waste_records
                                   WHERE org_id = ? AND substr(occurred_on, 1, 7) = ? GROUP BY reason ORDER BY cost DESC`).all(ctx.orgId, month)
  const month_total = ctx.db.prepare(`SELECT COUNT(*) AS n, ROUND(COALESCE(SUM(estimated_cost), 0), 2) AS cost FROM waste_records WHERE org_id = ? AND substr(occurred_on, 1, 7) = ?`).get(ctx.orgId, month)
  const year_total = ctx.db.prepare(`SELECT ROUND(COALESCE(SUM(estimated_cost), 0), 2) AS cost FROM waste_records WHERE org_id = ? AND substr(occurred_on, 1, 4) = ?`).get(ctx.orgId, month.slice(0, 4))
  const top = ctx.db.prepare(`SELECT description, COUNT(*) AS n, ROUND(COALESCE(SUM(estimated_cost), 0), 2) AS cost FROM waste_records
                              WHERE org_id = ? AND substr(occurred_on, 1, 7) = ? GROUP BY description ORDER BY cost DESC LIMIT 8`).all(ctx.orgId, month)
  return { month, byReason, month_total, year_total, top }
}

export function wasteInPeriod(ctx: Ctx, from: string, to: string): { n: number; cost: number } {
  return ctx.db.prepare('SELECT COUNT(*) AS n, ROUND(COALESCE(SUM(estimated_cost), 0), 2) AS cost FROM waste_records WHERE org_id = ? AND occurred_on BETWEEN ? AND ?').get(ctx.orgId, from, to) as { n: number; cost: number }
}

export function registerWaste(ctx: Ctx, input: unknown): WasteRecord {
  const d = wasteSchema.parse(input)
  const on = d.occurredOn ? parseDate(d.occurredOn) : today()
  if (!on) throw new ValidationError('Fecha no válida')
  const kind = d.kind ?? (d.recipeId != null ? 'dish' : 'ingredient')

  let ingredient = d.ingredientId != null ? getIngredient(ctx, d.ingredientId) : null
  if (!ingredient && kind === 'ingredient' && d.description) ingredient = findIngredientByName(ctx, d.description)
  const recipe = d.recipeId != null ? getRecipe(ctx, d.recipeId) : null
  if (kind === 'dish' && !recipe && !d.description) throw new ValidationError('Indica la receta o una descripción')
  if (kind === 'ingredient' && !ingredient && !d.description) throw new ValidationError('Indica el ingrediente o una descripción')

  let cost = d.estimatedCost ?? null
  if (ingredient) {
    // Misma magnitud que el ingrediente: no se merman "litros de pollo".
    if (!compatible(d.unit, ingredient.base_unit)) throw new ValidationError(`"${ingredient.name}" se mide en ${ingredient.base_unit}, no en ${d.unit}`)
    if (cost == null && ingredient.cost != null) cost = round2(d.qty * conversionFactor(d.unit, ingredient.base_unit) * ingredient.cost)
  } else if (recipe) {
    if (d.unit !== 'ud') throw new ValidationError('La merma de un plato se cuenta en raciones (ud)')
    if (cost == null) cost = round2(recipeCost(ctx, recipe.id).perPortion * d.qty)
  }

  return ctx.db.transaction(() => {
    const r = ctx.db.prepare(`INSERT INTO waste_records (org_id, kind, ingredient_id, recipe_id, description, qty, unit, reason, estimated_cost, occurred_on, location_id, warehouse_id, service, notes, created_by)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(ctx.orgId, kind, ingredient?.id ?? null, recipe?.id ?? null, d.description?.trim() || ingredient?.name || recipe?.name || '', d.qty, d.unit, d.reason || null, cost, on,
           d.locationId ?? null, d.warehouseId ?? ingredient?.warehouse_id ?? null, d.service || null, d.notes || null, ctx.userId)
    const id = Number(r.lastInsertRowid)
    if (d.consumeStock && ingredient) {
      registerOutflow(ctx, { ingredientId: ingredient.id, warehouseId: d.warehouseId ?? null, qty: d.qty, unit: d.unit, kind: 'waste', sourceType: 'waste', sourceId: id, occurredAt: on })
    }
    return ctx.db.prepare(`${SEL} WHERE id = ?`).get(id) as WasteRecord
  })()
}

export function removeWaste(ctx: Ctx, id: number): void {
  const used = ctx.db.prepare(`SELECT 1 FROM stock_movements WHERE org_id = ? AND source_type = 'waste' AND source_id = ?`).get(ctx.orgId, id)
  if (used) throw new ValidationError('Esta merma ya descontó stock: registra un ajuste en vez de borrarla')
  const r = ctx.db.prepare('DELETE FROM waste_records WHERE org_id = ? AND id = ?').run(ctx.orgId, id)
  if (!r.changes) throw new NotFoundError('Registro de merma no encontrado')
}
