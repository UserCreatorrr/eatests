// Los números se comprueban calculados a mano, no "que no pete".
import { describe, expect, it } from 'vitest'
import { costRecipes, explodeIngredients, foodCostPct, wasteFactor, wouldCreateCycle, type IngredientRef, type LineRef, type RecipeRef } from '@/server/domain/costing'

const ING: IngredientRef[] = [
  { id: 1, name: 'Tomate', baseUnit: 'kg', cost: 2 },
  { id: 2, name: 'Aceite', baseUnit: 'l', cost: 8 },
  { id: 3, name: 'Sal', baseUnit: 'kg', cost: 0.5 },
  { id: 4, name: 'Pasta', baseUnit: 'kg', cost: 1.5 },
  { id: 5, name: 'Alcachofa', baseUnit: 'kg', cost: 1 },
  { id: 6, name: 'Huevo', baseUnit: 'kg', cost: 4, avgUnitWeightG: 60 },
  { id: 7, name: 'Sin precio', baseUnit: 'kg', cost: null },
]
const salsa: RecipeRef = { id: 10, name: 'Salsa', kind: 'preparation', portions: 1, yieldQty: 2000, yieldUnit: 'g', salePrice: null }
const plato: RecipeRef = { id: 20, name: 'Pasta con salsa', kind: 'dish', portions: 2, yieldQty: null, yieldUnit: null, salePrice: 6 }
const sofrito: RecipeRef = { id: 30, name: 'Sofrito', kind: 'preparation', portions: 1, yieldQty: 1000, yieldUnit: 'g', salePrice: null }
const guiso: RecipeRef = { id: 40, name: 'Guiso', kind: 'dish', portions: 4, yieldQty: null, yieldUnit: null, salePrice: 9 }

const L = (id: number, recipeId: number, p: Partial<LineRef>): LineRef => ({
  id, recipeId, ingredientId: null, subRecipeId: null, freeName: null, freeUnitCost: null, qty: 1, unit: 'g', wastePct: 0, ...p,
})
const LINES: LineRef[] = [
  L(1, 10, { ingredientId: 1, qty: 1500, unit: 'g' }),   // 3,00
  L(2, 10, { ingredientId: 2, qty: 100, unit: 'ml' }),   // 0,80
  L(3, 10, { ingredientId: 3, qty: 10, unit: 'g' }),     // 0,005  → salsa 3,805
  L(4, 20, { subRecipeId: 10, qty: 200, unit: 'g' }),    // 0,3805
  L(5, 20, { ingredientId: 4, qty: 100, unit: 'g' }),    // 0,15   → plato 0,5305
  L(6, 30, { subRecipeId: 10, qty: 500, unit: 'g' }),    // 0,95125
  L(7, 30, { ingredientId: 2, qty: 50, unit: 'ml' }),    // 0,40   → sofrito 1,35125
  L(8, 40, { subRecipeId: 30, qty: 250, unit: 'g' }),    // 0,3378125
]

describe('merma', () => {
  it('1.900 g netos con 5% de merma son 2.000 g brutos', () => {
    expect(1900 * wasteFactor(5)).toBeCloseTo(2000, 9)
    expect(wasteFactor(0)).toBe(1)
    expect(wasteFactor(100)).toBe(wasteFactor(95))
  })
  it('el coste va sobre la cantidad bruta', () => {
    const r: RecipeRef = { id: 1, name: 'Alcachofas', kind: 'dish', portions: 1, yieldQty: null, yieldUnit: null, salePrice: null }
    const c = costRecipes([r], [L(1, 1, { ingredientId: 5, qty: 1900, unit: 'g', wastePct: 5 })], ING).get(1)!
    expect(c.total).toBe(2)
    expect(c.lines[0].grossQty).toBe(2000)
  })
})

describe('subrecetas', () => {
  const costs = costRecipes([salsa, plato, sofrito, guiso], LINES, ING)
  it('cuesta la elaboración y la reparte por unidad producida', () => {
    const s = costs.get(10)!
    expect(s.total).toBe(3.805)
    expect(s.perYieldUnit).toBeCloseTo(0.0019025, 10)
  })
  it('un plato que usa la elaboración coge su coste exacto', () => {
    expect(costs.get(20)!.total).toBe(0.5305)
    expect(costs.get(20)!.perPortion).toBe(0.2653)
    expect(costs.get(20)!.foodCostPct).toBe(4.42)
  })
  it('anida a tres niveles', () => {
    expect(costs.get(30)!.total).toBe(1.3513)
    expect(costs.get(40)!.total).toBe(0.3378)
  })
  it('detecta ciclos antes de guardar', () => {
    expect(wouldCreateCycle(10, 30, LINES)).toBe(true)    // sofrito ya contiene salsa
    expect(wouldCreateCycle(10, 10, LINES)).toBe(true)
    expect(wouldCreateCycle(40, 10, LINES)).toBe(false)
  })
  it('corta un ciclo ya existente sin colgarse', () => {
    const c = costRecipes([salsa, sofrito], [...LINES, L(99, 10, { subRecipeId: 30, qty: 1, unit: 'g' })], ING)
    expect(c.get(10)!.cycle || c.get(30)!.cycle).toBe(true)
  })
})

describe('avisos en vez de ceros silenciosos', () => {
  it('ingrediente sin precio, unidad incompatible y elaboración sin producción', () => {
    const r: RecipeRef = { id: 1, name: 'X', kind: 'dish', portions: 1, yieldQty: null, yieldUnit: null, salePrice: null }
    const noYield: RecipeRef = { id: 2, name: 'Base', kind: 'preparation', portions: 1, yieldQty: null, yieldUnit: null, salePrice: null }
    const c = costRecipes([r, noYield], [
      L(1, 1, { ingredientId: 7, qty: 100, unit: 'g' }),
      L(2, 1, { ingredientId: 1, qty: 2, unit: 'ud' }),
      L(3, 1, { subRecipeId: 2, qty: 100, unit: 'g' }),
      L(4, 2, { ingredientId: 1, qty: 100, unit: 'g' }),
    ], ING).get(1)!
    expect(c.incomplete).toBe(3)
    expect(c.lines.map(l => l.warning)).toEqual([
      '"Sin precio" no tiene precio de compra',
      '"Tomate" se compra en kg y la línea está en ud',
      '"Base" no declara cuánto produce',
    ])
  })
  it('acepta "ud" sobre un ingrediente en kg si declara peso medio', () => {
    const r: RecipeRef = { id: 1, name: 'Tortilla', kind: 'dish', portions: 1, yieldQty: null, yieldUnit: null, salePrice: null }
    const c = costRecipes([r], [L(1, 1, { ingredientId: 6, qty: 3, unit: 'ud' })], ING).get(1)!
    expect(c.total).toBe(0.72)   // 3 huevos x 60 g = 180 g x 4 €/kg
    expect(c.incomplete).toBe(0)
  })
})

describe('food cost', () => {
  it('por ración, con guard rail', () => {
    expect(foodCostPct(2.217, 7.9)).toBe(28.06)
    expect(foodCostPct(1, null)).toBeNull()
    expect(foodCostPct(50, 1)).toBeNull()
  })
})

describe('explosión de ingredientes', () => {
  it('una elaboración no se compra: se compran sus ingredientes', () => {
    const items = explodeIngredients(20, [salsa, plato, sofrito, guiso], LINES, ING, 5)
    const byName = Object.fromEntries(items.map(i => [i.name, i]))
    expect(byName['Tomate'].qty).toBeCloseTo(0.75, 6)      // 5 x 200 g de salsa → 1 kg salsa → 750 g tomate
    expect(byName['Tomate'].unit).toBe('kg')
    expect(byName['Pasta'].qty).toBeCloseTo(0.5, 6)
    expect(byName['Salsa']).toBeUndefined()
  })
})
