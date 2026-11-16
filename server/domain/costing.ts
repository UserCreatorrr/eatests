// Motor de coste del escandallo. Puro: recibe recetas, líneas e ingredientes
// ya cargados y devuelve costes. Es la ÚNICA definición del food cost.
//
// Convenios:
//  - La cantidad de una línea es NETA (lo que acaba en el plato). El consumo
//    real es qty / (1 - waste/100): 1.900 g netos con 5% de merma son 2.000 g.
//  - Una subreceta se cuesta por su rendimiento (yield): coste total de la
//    elaboración / cantidad producida, convertido a la unidad de la línea.
//  - Los ciclos se detectan y se cortan: la línea queda a 0 con aviso.
//  - Nada se redondea por el camino; solo las cifras que se devuelven.

import { ConflictError } from './errors'
import { round4 } from './money'
import { conversionFactor, compatible, type Unit } from './units'

export interface IngredientRef { id: number; name: string; baseUnit: Unit; cost: number | null; avgUnitWeightG?: number | null; priceDate?: string | null }
export interface RecipeRef {
  id: number; name: string; kind: 'dish' | 'preparation'
  portions: number; yieldQty: number | null; yieldUnit: Unit | null; salePrice: number | null
}
export interface LineRef {
  id: number; recipeId: number
  ingredientId: number | null; subRecipeId: number | null; freeName: string | null; freeUnitCost: number | null
  qty: number; unit: Unit; wastePct: number
}

export interface LineCost {
  lineId: number
  kind: 'ingredient' | 'preparation' | 'free'
  name: string
  qty: number
  unit: Unit
  wastePct: number
  grossQty: number          // lo que sale del almacén
  unitCost: number          // € por unidad de la línea
  cost: number
  warning: string | null    // por qué no suma
  priceDate: string | null  // fecha del precio usado (ingredientes)
}

export interface RecipeCost {
  recipeId: number
  name: string
  kind: 'dish' | 'preparation'
  lines: LineCost[]
  total: number
  perPortion: number
  /** € por unidad producida (yieldUnit); lo que vale usarla como subreceta */
  perYieldUnit: number | null
  yieldUnit: Unit | null
  salePrice: number | null
  foodCostPct: number | null
  incomplete: number        // líneas sin coste
  cycle: boolean
}

/** Multiplicador de consumo por merma. 0% → 1; 25% → 1,333… Tope 95%. */
export function wasteFactor(wastePct: number): number {
  const w = Math.min(Math.max(wastePct || 0, 0), 95)
  return 1 / (1 - w / 100)
}

export function foodCostPct(costPerPortion: number, salePrice: number | null): number | null {
  if (!salePrice || salePrice <= 0 || costPerPortion <= 0) return null
  const pct = (costPerPortion / salePrice) * 100
  // Más del 300% no es un plato caro, es un dato mal metido.
  return pct > 300 ? null : Math.round(pct * 100) / 100
}

export function foodCostLevel(pct: number | null): 'excellent' | 'healthy' | 'review' | 'critical' | 'unknown' {
  if (pct == null) return 'unknown'
  if (pct > 40) return 'critical'
  if (pct > 33) return 'review'
  if (pct > 25) return 'healthy'
  return 'excellent'
}

/**
 * Factor para pasar de la unidad de una línea a la del ingrediente. Admite
 * "ud" en la línea con ingrediente en kg cuando el ingrediente declara peso
 * medio por unidad (1 huevo = 60 g).
 */
function lineToIngredientFactor(line: LineRef, ing: IngredientRef): number | null {
  if (compatible(line.unit, ing.baseUnit)) return conversionFactor(line.unit, ing.baseUnit)
  if (line.unit === 'ud' && ing.baseUnit === 'kg' && ing.avgUnitWeightG && ing.avgUnitWeightG > 0) {
    return ing.avgUnitWeightG / 1000
  }
  return null
}

export function costRecipes(
  recipes: RecipeRef[],
  lines: LineRef[],
  ingredients: IngredientRef[],
): Map<number, RecipeCost> {
  const recipeById = new Map(recipes.map(r => [r.id, r]))
  const ingById = new Map(ingredients.map(i => [i.id, i]))
  const linesByRecipe = new Map<number, LineRef[]>()
  for (const l of lines) {
    if (!linesByRecipe.has(l.recipeId)) linesByRecipe.set(l.recipeId, [])
    linesByRecipe.get(l.recipeId)!.push(l)
  }

  const memo = new Map<number, RecipeCost>()
  const stack = new Set<number>()

  function resolve(r: RecipeRef): RecipeCost {
    const done = memo.get(r.id)
    if (done) return done
    const portions = r.portions > 0 ? r.portions : 1
    const out: RecipeCost = {
      recipeId: r.id, name: r.name, kind: r.kind, lines: [], total: 0, perPortion: 0,
      perYieldUnit: null, yieldUnit: r.yieldUnit, salePrice: r.salePrice, foodCostPct: null, incomplete: 0, cycle: false,
    }
    if (stack.has(r.id)) { out.cycle = true; return out }   // parcial: no se memoriza
    stack.add(r.id)
    let total = 0
    for (const l of linesByRecipe.get(r.id) ?? []) {
      const lc = costLine(l)
      out.lines.push(lc)
      if (lc.warning) out.incomplete++
      total += lc.cost
    }
    stack.delete(r.id)
    if (out.lines.some(l => l.warning?.includes('circular'))) out.cycle = true
    out.total = total
    out.perPortion = total / portions
    out.perYieldUnit = r.yieldQty && r.yieldQty > 0 ? total / r.yieldQty : null
    out.foodCostPct = foodCostPct(out.perPortion, r.salePrice)
    memo.set(r.id, out)
    return out
  }

  function costLine(l: LineRef): LineCost {
    const gross = l.qty * wasteFactor(l.wastePct)
    const base: LineCost = {
      lineId: l.id, kind: 'free', name: l.freeName ?? '', qty: l.qty, unit: l.unit, wastePct: l.wastePct,
      grossQty: gross, unitCost: 0, cost: 0, warning: null, priceDate: null,
    }
    if (l.subRecipeId != null) {
      base.kind = 'preparation'
      const sub = recipeById.get(l.subRecipeId)
      if (!sub) return { ...base, warning: 'La elaboración enlazada ya no existe' }
      base.name = sub.name
      if (stack.has(sub.id)) return { ...base, warning: `"${sub.name}" se usa a sí misma (referencia circular)` }
      const subCost = resolve(sub)
      if (!sub.yieldQty || !sub.yieldUnit) return { ...base, warning: `"${sub.name}" no declara cuánto produce` }
      if (!compatible(l.unit, sub.yieldUnit)) return { ...base, warning: `"${sub.name}" se produce en ${sub.yieldUnit}, no en ${l.unit}` }
      if (subCost.cycle) base.warning = `"${sub.name}" contiene una referencia circular`
      const perUnit = (subCost.perYieldUnit ?? 0) * conversionFactor(l.unit, sub.yieldUnit)
      if (perUnit <= 0) return { ...base, warning: base.warning ?? `"${sub.name}" todavía no tiene coste` }
      return { ...base, unitCost: perUnit, cost: gross * perUnit }
    }
    if (l.ingredientId != null) {
      base.kind = 'ingredient'
      const ing = ingById.get(l.ingredientId)
      if (!ing) return { ...base, warning: 'El ingrediente ya no existe' }
      base.name = ing.name
      base.priceDate = ing.priceDate ?? null
      if (ing.cost == null || ing.cost <= 0) return { ...base, warning: `"${ing.name}" no tiene precio de compra` }
      const f = lineToIngredientFactor(l, ing)
      if (f == null) return { ...base, warning: `"${ing.name}" se compra en ${ing.baseUnit} y la línea está en ${l.unit}` }
      return { ...base, unitCost: ing.cost * f, cost: gross * ing.cost * f }
    }
    if (!l.freeUnitCost || l.freeUnitCost <= 0) return { ...base, warning: 'Línea sin precio' }
    return { ...base, unitCost: l.freeUnitCost, cost: gross * l.freeUnitCost }
  }

  const out = new Map<number, RecipeCost>()
  for (const r of recipes) {
    const c = resolve(r)
    out.set(r.id, {
      ...c,
      total: round4(c.total), perPortion: round4(c.perPortion),
      lines: c.lines.map(l => ({ ...l, grossQty: round4(l.grossQty), unitCost: round4(l.unitCost), cost: round4(l.cost) })),
    })
  }
  return out
}

/** true si añadir `subRecipeId` a `recipeId` crearía un ciclo. */
export function wouldCreateCycle(recipeId: number, subRecipeId: number, lines: Pick<LineRef, 'recipeId' | 'subRecipeId'>[]): boolean {
  if (recipeId === subRecipeId) return true
  const stack = [subRecipeId]
  const seen = new Set<number>()
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === recipeId) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const l of lines) if (l.recipeId === cur && l.subRecipeId != null) stack.push(l.subRecipeId)
  }
  return false
}

export function assertNoCycle(recipeId: number, subRecipeId: number, lines: Pick<LineRef, 'recipeId' | 'subRecipeId'>[]): void {
  if (wouldCreateCycle(recipeId, subRecipeId, lines)) {
    throw new ConflictError('Esa elaboración ya depende de esta receta: se crearía una referencia circular')
  }
}

export interface IngredientConsumption { ingredientId: number | null; name: string; qty: number; unit: Unit }

/**
 * Descompone una receta en los ingredientes que salen del almacén, bajando
 * por las elaboraciones hasta el fondo. Cantidades brutas en la unidad base
 * del ingrediente.
 */
export function explodeIngredients(
  recipeId: number, recipes: RecipeRef[], lines: LineRef[], ingredients: IngredientRef[], multiplier = 1,
): IngredientConsumption[] {
  const recipeById = new Map(recipes.map(r => [r.id, r]))
  const ingById = new Map(ingredients.map(i => [i.id, i]))
  const linesByRecipe = new Map<number, LineRef[]>()
  for (const l of lines) (linesByRecipe.get(l.recipeId) ?? linesByRecipe.set(l.recipeId, []).get(l.recipeId)!).push(l)

  const acc = new Map<string, IngredientConsumption>()
  const visiting = new Set<number>()
  function walk(id: number, mult: number) {
    if (visiting.has(id)) return
    visiting.add(id)
    for (const l of linesByRecipe.get(id) ?? []) {
      const gross = l.qty * wasteFactor(l.wastePct) * mult
      if (l.subRecipeId != null) {
        const sub = recipeById.get(l.subRecipeId)
        if (!sub?.yieldQty || !sub.yieldUnit || !compatible(l.unit, sub.yieldUnit)) continue
        walk(sub.id, (gross * conversionFactor(l.unit, sub.yieldUnit)) / sub.yieldQty)
        continue
      }
      const ing = l.ingredientId != null ? ingById.get(l.ingredientId) : undefined
      const f = ing ? lineToIngredientFactor(l, ing) : null
      const key = ing ? `i${ing.id}` : `f${(l.freeName ?? '').toLowerCase()}`
      const unit = ing && f != null ? ing.baseUnit : l.unit
      const qty = ing && f != null ? gross * f : gross
      const cur = acc.get(key)
      if (cur) cur.qty += qty
      else acc.set(key, { ingredientId: ing?.id ?? null, name: ing?.name ?? l.freeName ?? '', qty, unit })
    }
    visiting.delete(id)
  }
  walk(recipeId, multiplier)
  return Array.from(acc.values()).map(c => ({ ...c, qty: Math.round(c.qty * 100000) / 100000 }))
}
