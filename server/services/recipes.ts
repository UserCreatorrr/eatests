// Escandallo: recetas (platos y elaboraciones), líneas, merma, producción.
// El coste lo calcula el motor puro de server/domain/costing; aquí solo se
// cargan los datos y se aplican las reglas de guardado.
import { z } from 'zod'
import { costRecipes, explodeIngredients, foodCostLevel, assertNoCycle, type IngredientRef, type LineRef, type RecipeCost, type RecipeRef } from '@/server/domain/costing'
import { nowIso, parseDate, today } from '@/server/domain/dates'
import { ConflictError, NotFoundError, ValidationError } from '@/server/domain/errors'
import { compatible, parseUnit, type Unit } from '@/server/domain/units'
import type { Ctx } from '@/server/http/context'
import { getIngredient } from './catalog'
import { registerOutflow } from './stock'

const unitField = z.string().transform((v, c) => {
  const u = parseUnit(v)
  if (!u) { c.addIssue({ code: 'custom', message: `Unidad no válida: ${v}` }); return z.NEVER }
  return u
})

export const recipeSchema = z.object({
  name: z.string().trim().min(1, 'Falta el nombre de la receta').max(160),
  code: z.string().trim().max(40).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  kind: z.enum(['dish', 'preparation']).optional(),
  portions: z.number().int().positive().max(10000).optional(),
  yieldQty: z.number().positive().max(1e6).optional().nullable(),
  yieldUnit: unitField.optional().nullable(),
  portionWeightG: z.number().positive().optional().nullable(),
  salePrice: z.number().min(0).max(1e5).optional().nullable(),
  generalWastePct: z.number().min(0).max(95).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  allergens: z.string().trim().max(500).optional().nullable(),
  procedure: z.array(z.any()).optional().nullable(),
  conservation: z.string().trim().max(1000).optional().nullable(),
  regeneration: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  source: z.enum(['manual', 'excel', 'ai']).optional(),
  active: z.boolean().optional(),
})

export const lineSchema = z.object({
  ingredientId: z.number().int().positive().optional().nullable(),
  subRecipeId: z.number().int().positive().optional().nullable(),
  freeName: z.string().trim().max(160).optional().nullable(),
  freeUnitCost: z.number().min(0).optional().nullable(),
  qty: z.number().positive('La cantidad debe ser mayor que 0').max(1e6),
  unit: unitField,
  wastePct: z.number().min(0).max(95).optional(),
  note: z.string().trim().max(500).optional().nullable(),
})

export interface Recipe {
  id: number; code: string | null; name: string; category: string | null; kind: 'dish' | 'preparation'; portions: number
  yield_qty: number | null; yield_unit: Unit | null; portion_weight_g: number | null; sale_price: number | null; general_waste_pct: number | null
  description: string | null; allergens: string | null; procedure_json: string | null; conservation: string | null; regeneration: string | null
  notes: string | null; source: string; active: number; created_at: string; updated_at: string
}
export interface RecipeLine {
  id: number; recipe_id: number; ingredient_id: number | null; sub_recipe_id: number | null; free_name: string | null; free_unit_cost: number | null
  qty: number; unit: Unit; waste_pct: number; sort_order: number; note: string | null
  ingredient_name: string | null; ingredient_unit: Unit | null; ingredient_cost: number | null; sub_recipe_name: string | null; sub_recipe_yield_unit: Unit | null
}

const R_COLS = 'id, code, name, category, kind, portions, yield_qty, yield_unit, portion_weight_g, sale_price, general_waste_pct, description, allergens, procedure_json, conservation, regeneration, notes, source, active, created_at, updated_at'

export function listRecipes(ctx: Ctx, opts: { includeInactive?: boolean; kind?: 'dish' | 'preparation' } = {}): Recipe[] {
  const where = ['org_id = ?']; const vals: unknown[] = [ctx.orgId]
  if (!opts.includeInactive) where.push('active = 1')
  if (opts.kind) { where.push('kind = ?'); vals.push(opts.kind) }
  return ctx.db.prepare(`SELECT ${R_COLS} FROM recipes WHERE ${where.join(' AND ')} ORDER BY name COLLATE NOCASE`).all(...vals) as Recipe[]
}

export function getRecipe(ctx: Ctx, id: number): Recipe {
  const r = ctx.db.prepare(`SELECT ${R_COLS} FROM recipes WHERE org_id = ? AND id = ?`).get(ctx.orgId, id) as Recipe | undefined
  if (!r) throw new NotFoundError('Receta no encontrada')
  return r
}

export function recipeLines(ctx: Ctx, recipeId: number): RecipeLine[] {
  return ctx.db.prepare(`SELECT l.id, l.recipe_id, l.ingredient_id, l.sub_recipe_id, l.free_name, l.free_unit_cost, l.qty, l.unit, l.waste_pct, l.sort_order, l.note,
                                i.name AS ingredient_name, i.base_unit AS ingredient_unit, i.cost AS ingredient_cost, s.name AS sub_recipe_name, s.yield_unit AS sub_recipe_yield_unit
                         FROM recipe_lines l
                         LEFT JOIN ingredients i ON i.org_id = l.org_id AND i.id = l.ingredient_id
                         LEFT JOIN recipes s ON s.org_id = l.org_id AND s.id = l.sub_recipe_id
                         WHERE l.org_id = ? AND l.recipe_id = ? ORDER BY l.sort_order, l.id`).all(ctx.orgId, recipeId) as RecipeLine[]
}

function recipeValues(d: z.infer<typeof recipeSchema>) {
  if ((d.yieldQty == null) !== (d.yieldUnit == null)) throw new ValidationError('La producción necesita cantidad y unidad')
  return {
    code: d.code ?? null, name: d.name, category: d.category ?? null, kind: d.kind ?? 'dish', portions: d.portions ?? 1,
    yield_qty: d.yieldQty ?? null, yield_unit: d.yieldUnit ?? null, portion_weight_g: d.portionWeightG ?? null, sale_price: d.salePrice ?? null,
    general_waste_pct: d.generalWastePct ?? null, description: d.description ?? null, allergens: d.allergens ?? null,
    procedure_json: d.procedure?.length ? JSON.stringify(d.procedure) : null, conservation: d.conservation ?? null, regeneration: d.regeneration ?? null,
    notes: d.notes ?? null, source: d.source ?? 'manual', active: d.active === false ? 0 : 1,
  }
}

export function createRecipe(ctx: Ctx, input: unknown): Recipe {
  const d = recipeSchema.parse(input)
  const dup = ctx.db.prepare('SELECT id, name FROM recipes WHERE org_id = ? AND name = ? COLLATE NOCASE').get(ctx.orgId, d.name) as any
  if (dup) throw new ConflictError(`Ya existe la receta "${dup.name}"`, { recipeId: dup.id })
  const v = recipeValues(d)
  const cols = Object.keys(v)
  const r = ctx.db.prepare(`INSERT INTO recipes (org_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`).run(ctx.orgId, ...Object.values(v))
  return getRecipe(ctx, Number(r.lastInsertRowid))
}

export function updateRecipe(ctx: Ctx, id: number, input: unknown): Recipe {
  const cur = getRecipe(ctx, id)
  const d = recipeSchema.partial().parse(input)
  if (d.name && d.name.toLowerCase() !== cur.name.toLowerCase()) {
    const dup = ctx.db.prepare('SELECT id FROM recipes WHERE org_id = ? AND name = ? COLLATE NOCASE AND id <> ?').get(ctx.orgId, d.name, id)
    if (dup) throw new ConflictError(`Ya existe la receta "${d.name}"`)
  }
  const yq = d.yieldQty !== undefined ? d.yieldQty : cur.yield_qty
  const yu = d.yieldUnit !== undefined ? d.yieldUnit : cur.yield_unit
  if ((yq == null) !== (yu == null)) throw new ValidationError('La producción necesita cantidad y unidad')
  // Cambiar la unidad de producción rompe las recetas que la usan en otra magnitud.
  if (yu && yu !== cur.yield_unit) {
    const users = ctx.db.prepare('SELECT unit FROM recipe_lines WHERE org_id = ? AND sub_recipe_id = ?').all(ctx.orgId, id) as { unit: Unit }[]
    const bad = users.filter(u => !compatible(u.unit, yu))
    if (bad.length) throw new ConflictError(`${bad.length} receta(s) usan esta elaboración en ${bad[0].unit}; no puede producirse en ${yu}`)
  }
  const map: Record<string, unknown> = {
    code: d.code, name: d.name, category: d.category, kind: d.kind, portions: d.portions, yield_qty: d.yieldQty, yield_unit: d.yieldUnit,
    portion_weight_g: d.portionWeightG, sale_price: d.salePrice, general_waste_pct: d.generalWastePct, description: d.description, allergens: d.allergens,
    procedure_json: d.procedure === undefined ? undefined : (d.procedure?.length ? JSON.stringify(d.procedure) : null),
    conservation: d.conservation, regeneration: d.regeneration, notes: d.notes, active: d.active === undefined ? undefined : (d.active ? 1 : 0),
  }
  const sets: string[] = []; const vals: unknown[] = []
  for (const [k, v] of Object.entries(map)) if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v) }
  if (!sets.length) throw new ValidationError('Nada que actualizar')
  sets.push('updated_at = ?'); vals.push(nowIso())
  ctx.db.prepare(`UPDATE recipes SET ${sets.join(', ')} WHERE org_id = ? AND id = ?`).run(...vals, ctx.orgId, id)
  return getRecipe(ctx, id)
}

/** Una receta usada como elaboración en otras no se borra: se desactiva. */
export function removeRecipe(ctx: Ctx, id: number): { deleted: boolean } {
  getRecipe(ctx, id)
  const used = (ctx.db.prepare('SELECT COUNT(*) AS n FROM recipe_lines WHERE org_id = ? AND sub_recipe_id = ?').get(ctx.orgId, id) as any).n
    + (ctx.db.prepare('SELECT COUNT(*) AS n FROM production_records WHERE org_id = ? AND recipe_id = ?').get(ctx.orgId, id) as any).n
  if (used > 0) { ctx.db.prepare('UPDATE recipes SET active = 0, updated_at = ? WHERE org_id = ? AND id = ?').run(nowIso(), ctx.orgId, id); return { deleted: false } }
  ctx.db.prepare('DELETE FROM recipes WHERE org_id = ? AND id = ?').run(ctx.orgId, id)   // las líneas caen en cascada
  return { deleted: true }
}

// ─── Líneas ─────────────────────────────────────────────────────────────

function allLineRefs(ctx: Ctx): LineRef[] {
  return (ctx.db.prepare('SELECT id, recipe_id, ingredient_id, sub_recipe_id, free_name, free_unit_cost, qty, unit, waste_pct FROM recipe_lines WHERE org_id = ?').all(ctx.orgId) as any[])
    .map(l => ({ id: l.id, recipeId: l.recipe_id, ingredientId: l.ingredient_id, subRecipeId: l.sub_recipe_id, freeName: l.free_name, freeUnitCost: l.free_unit_cost, qty: l.qty, unit: l.unit, wastePct: l.waste_pct }))
}

function checkLine(ctx: Ctx, recipeId: number, l: z.infer<typeof lineSchema>) {
  const kinds = [l.ingredientId, l.subRecipeId, l.freeName].filter(v => v != null && v !== '').length
  if (kinds !== 1) throw new ValidationError('Una línea es un ingrediente, una elaboración o una línea libre, solo una cosa')
  if (l.ingredientId) {
    const ing = getIngredient(ctx, l.ingredientId)
    const ok = compatible(l.unit, ing.base_unit) || (l.unit === 'ud' && ing.base_unit === 'kg' && !!ing.avg_unit_weight_g)
    if (!ok) throw new ValidationError(`"${ing.name}" se controla en ${ing.base_unit} y la línea está en ${l.unit}. Usa una unidad de la misma magnitud`)
  }
  if (l.subRecipeId) {
    const sub = getRecipe(ctx, l.subRecipeId)
    if (!sub.yield_qty || !sub.yield_unit) throw new ValidationError(`Antes de usar "${sub.name}" como elaboración, indica cuánto produce (por ejemplo 2000 g)`)
    if (!compatible(l.unit, sub.yield_unit)) throw new ValidationError(`"${sub.name}" se produce en ${sub.yield_unit}, no en ${l.unit}`)
    assertNoCycle(recipeId, l.subRecipeId, allLineRefs(ctx))
  }
}

export function addLine(ctx: Ctx, recipeId: number, input: unknown): RecipeLine[] {
  getRecipe(ctx, recipeId)
  const l = lineSchema.parse(input)
  checkLine(ctx, recipeId, l)
  const n = (ctx.db.prepare('SELECT COUNT(*) AS n FROM recipe_lines WHERE org_id = ? AND recipe_id = ?').get(ctx.orgId, recipeId) as any).n
  ctx.db.prepare(`INSERT INTO recipe_lines (org_id, recipe_id, ingredient_id, sub_recipe_id, free_name, free_unit_cost, qty, unit, waste_pct, sort_order, note)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(ctx.orgId, recipeId, l.ingredientId ?? null, l.subRecipeId ?? null, l.freeName || null, l.freeUnitCost ?? null, l.qty, l.unit, l.wastePct ?? 0, n, l.note ?? null)
  touch(ctx, recipeId)
  return recipeLines(ctx, recipeId)
}

export function updateLine(ctx: Ctx, recipeId: number, lineId: number, input: unknown): RecipeLine[] {
  const cur = recipeLines(ctx, recipeId).find(l => l.id === lineId)
  if (!cur) throw new NotFoundError('Línea no encontrada')
  const d = lineSchema.partial().parse(input)
  const merged = { ingredientId: cur.ingredient_id, subRecipeId: cur.sub_recipe_id, freeName: cur.free_name, freeUnitCost: cur.free_unit_cost,
                   qty: cur.qty, unit: cur.unit, wastePct: cur.waste_pct, note: cur.note, ...stripUndefined(d) }
  checkLine(ctx, recipeId, merged as any)
  ctx.db.prepare(`UPDATE recipe_lines SET ingredient_id = ?, sub_recipe_id = ?, free_name = ?, free_unit_cost = ?, qty = ?, unit = ?, waste_pct = ?, note = ?
                  WHERE org_id = ? AND recipe_id = ? AND id = ?`)
    .run(merged.ingredientId ?? null, merged.subRecipeId ?? null, merged.freeName || null, merged.freeUnitCost ?? null, merged.qty, merged.unit, merged.wastePct ?? 0, merged.note ?? null,
         ctx.orgId, recipeId, lineId)
  touch(ctx, recipeId)
  return recipeLines(ctx, recipeId)
}

export function removeLine(ctx: Ctx, recipeId: number, lineId: number): void {
  const r = ctx.db.prepare('DELETE FROM recipe_lines WHERE org_id = ? AND recipe_id = ? AND id = ?').run(ctx.orgId, recipeId, lineId)
  if (!r.changes) throw new NotFoundError('Línea no encontrada')
  touch(ctx, recipeId)
}

export function reorderLines(ctx: Ctx, recipeId: number, lineIds: number[]): void {
  getRecipe(ctx, recipeId)
  const upd = ctx.db.prepare('UPDATE recipe_lines SET sort_order = ? WHERE org_id = ? AND recipe_id = ? AND id = ?')
  ctx.db.transaction(() => lineIds.forEach((id, i) => upd.run(i, ctx.orgId, recipeId, id)))()
}

function touch(ctx: Ctx, recipeId: number) {
  ctx.db.prepare('UPDATE recipes SET updated_at = ? WHERE org_id = ? AND id = ?').run(nowIso(), ctx.orgId, recipeId)
}
function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

// ─── Coste ──────────────────────────────────────────────────────────────

function loadRefs(ctx: Ctx) {
  const recipes: RecipeRef[] = (ctx.db.prepare('SELECT id, name, kind, portions, yield_qty, yield_unit, sale_price FROM recipes WHERE org_id = ?').all(ctx.orgId) as any[])
    .map(r => ({ id: r.id, name: r.name, kind: r.kind, portions: r.portions, yieldQty: r.yield_qty, yieldUnit: r.yield_unit, salePrice: r.sale_price }))
  // Fecha del precio en uso: la última observación con ese mismo precio; si el
  // coste se tecleó a mano sin observación, la fecha en que se cambió.
  const ingredients: IngredientRef[] = (ctx.db.prepare(`SELECT i.id, i.name, i.base_unit, i.cost, i.avg_unit_weight_g,
      COALESCE((SELECT MAX(p.observed_on) FROM price_observations p WHERE p.org_id = i.org_id AND p.ingredient_id = i.id AND ABS(p.unit_price - i.cost) < 0.00005),
               substr(i.cost_updated_at, 1, 10)) AS price_date
      FROM ingredients i WHERE i.org_id = ?`).all(ctx.orgId) as any[])
    .map(i => ({ id: i.id, name: i.name, baseUnit: i.base_unit, cost: i.cost, avgUnitWeightG: i.avg_unit_weight_g, priceDate: i.price_date ?? null }))
  return { recipes, lines: allLineRefs(ctx), ingredients }
}

/** Referencias crudas para otros servicios (consumo teórico). */
export const _refs = loadRefs

/** Coste de todas las recetas de la organización en una pasada. */
export function recipeCosts(ctx: Ctx): Map<number, RecipeCost> {
  const { recipes, lines, ingredients } = loadRefs(ctx)
  return costRecipes(recipes, lines, ingredients)
}

export function recipeCost(ctx: Ctx, id: number): RecipeCost {
  const c = recipeCosts(ctx).get(id)
  if (!c) throw new NotFoundError('Receta no encontrada')
  return c
}

/** Platos activos con food cost por encima del umbral, de peor a mejor. */
export function criticalRecipes(ctx: Ctx, thresholdPct = 35, limit = 5) {
  return Array.from(recipeCosts(ctx).values())
    .filter(c => c.kind === 'dish' && c.foodCostPct != null && c.foodCostPct > thresholdPct)
    .map(c => ({ id: c.recipeId, name: c.name, foodCostPct: c.foodCostPct!, perPortion: c.perPortion, salePrice: c.salePrice, level: foodCostLevel(c.foodCostPct) }))
    .sort((a, b) => b.foodCostPct - a.foodCostPct)
    .slice(0, limit)
}

/** Elaboraciones que esta receta puede usar sin crear un ciclo. */
export function availablePreparations(ctx: Ctx, recipeId: number | null) {
  const costs = recipeCosts(ctx)
  const lines = allLineRefs(ctx)
  return listRecipes(ctx, { kind: 'preparation' })
    .filter(p => p.yield_qty && p.yield_unit && (recipeId == null || (p.id !== recipeId && !wouldCycle(recipeId, p.id, lines))))
    .map(p => ({ id: p.id, name: p.name, yieldQty: p.yield_qty, yieldUnit: p.yield_unit, perYieldUnit: costs.get(p.id)?.perYieldUnit ?? null }))
}
function wouldCycle(recipeId: number, subId: number, lines: LineRef[]) {
  try { assertNoCycle(recipeId, subId, lines); return false } catch { return true }
}

/** Ingredientes que salen del almacén al producir `portions` raciones (o lotes) de la receta. */
export function ingredientsToConsume(ctx: Ctx, recipeId: number, portions: number) {
  const r = getRecipe(ctx, recipeId)
  const { recipes, lines, ingredients } = loadRefs(ctx)
  return explodeIngredients(recipeId, recipes, lines, ingredients, portions / (r.portions || 1))
}

// ─── Producción ─────────────────────────────────────────────────────────

export const productionSchema = z.object({
  recipeId: z.number().int().positive(),
  portions: z.number().int().positive().max(100000),
  producedOn: z.string().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  /** Descontar del stock los ingredientes consumidos (requiere stock llevado). */
  consumeStock: z.boolean().optional(),
})

export function registerProduction(ctx: Ctx, input: unknown) {
  const d = productionSchema.parse(input)
  const r = getRecipe(ctx, d.recipeId)
  const on = d.producedOn ? parseDate(d.producedOn) : today()
  if (!on) throw new ValidationError('Fecha no válida')
  return ctx.db.transaction(() => {
    const ins = ctx.db.prepare('INSERT INTO production_records (org_id, recipe_id, description, portions, produced_on, notes) VALUES (?, ?, ?, ?, ?, ?)')
      .run(ctx.orgId, r.id, r.name, d.portions, on, d.notes ?? null)
    const id = Number(ins.lastInsertRowid)
    let movements = 0
    if (d.consumeStock) {
      for (const c of ingredientsToConsume(ctx, r.id, d.portions)) {
        if (c.ingredientId == null || c.qty <= 0) continue
        registerOutflow(ctx, { ingredientId: c.ingredientId, qty: c.qty, unit: c.unit, kind: 'production', sourceType: 'production', sourceId: id, occurredAt: on })
        movements++
      }
    }
    return { id, movements }
  })()
}
