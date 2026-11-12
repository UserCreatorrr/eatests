import { beforeEach, describe, expect, it } from 'vitest'
import { ConflictError, ValidationError } from '@/server/domain/errors'
import type { Ctx } from '@/server/http/context'
import { createIngredient } from '@/server/services/catalog'
import { addLine, availablePreparations, createRecipe, ingredientsToConsume, recipeCost, recipeLines, registerProduction, removeLine, removeRecipe, updateLine, updateRecipe } from '@/server/services/recipes'
import { registerReceipt, stockLevels } from '@/server/services/stock'
import { testCtx } from '../helpers'

let ctx: Ctx, tomate: number, aceite: number, pasta: number, huevo: number
beforeEach(() => {
  ctx = testCtx()
  tomate = createIngredient(ctx, { name: 'Tomate', baseUnit: 'kg', cost: 2 }).id
  aceite = createIngredient(ctx, { name: 'Aceite', baseUnit: 'l', cost: 8 }).id
  pasta = createIngredient(ctx, { name: 'Pasta', baseUnit: 'kg', cost: 1.5 }).id
  huevo = createIngredient(ctx, { name: 'Huevo', baseUnit: 'kg', cost: 4, avgUnitWeightG: 60 }).id
})

describe('recetas', () => {
  it('crea platos y elaboraciones, sin nombres repetidos', () => {
    const salsa = createRecipe(ctx, { name: 'Salsa de tomate', kind: 'preparation', yieldQty: 2000, yieldUnit: 'g' })
    expect(salsa.kind).toBe('preparation')
    expect(() => createRecipe(ctx, { name: 'salsa DE tomate' })).toThrow(ConflictError)
    expect(() => createRecipe(ctx, { name: 'Base', kind: 'preparation', yieldQty: 500 })).toThrow(/cantidad y unidad/)
  })
  it('una línea es exactamente una cosa y respeta magnitudes', () => {
    const r = createRecipe(ctx, { name: 'Plato', portions: 2, salePrice: 6 })
    expect(() => addLine(ctx, r.id, { qty: 1, unit: 'g' })).toThrow(ValidationError)
    expect(() => addLine(ctx, r.id, { ingredientId: tomate, freeName: 'x', qty: 1, unit: 'g' })).toThrow(ValidationError)
    expect(() => addLine(ctx, r.id, { ingredientId: tomate, qty: 1, unit: 'ud' })).toThrow(/misma magnitud/)
    expect(() => addLine(ctx, r.id, { ingredientId: aceite, qty: 1, unit: 'Litros' })).not.toThrow()
    // "ud" sobre kg sí, si hay peso medio
    expect(() => addLine(ctx, r.id, { ingredientId: huevo, qty: 2, unit: 'ud' })).not.toThrow()
  })
})

describe('coste con subrecetas y merma (igual que el motor puro, pero desde la BD)', () => {
  it('calcula, anida y expone el coste por unidad producida', () => {
    const salsa = createRecipe(ctx, { name: 'Salsa', kind: 'preparation', yieldQty: 2000, yieldUnit: 'g' })
    addLine(ctx, salsa.id, { ingredientId: tomate, qty: 1500, unit: 'g' })
    addLine(ctx, salsa.id, { ingredientId: aceite, qty: 100, unit: 'ml' })
    const plato = createRecipe(ctx, { name: 'Pasta con salsa', portions: 2, salePrice: 6 })
    addLine(ctx, plato.id, { subRecipeId: salsa.id, qty: 200, unit: 'g' })
    addLine(ctx, plato.id, { ingredientId: pasta, qty: 100, unit: 'g' })
    addLine(ctx, plato.id, { ingredientId: tomate, qty: 180, unit: 'g', wastePct: 40 })   // 300 g brutos → 0,60
    const c = recipeCost(ctx, plato.id)
    expect(recipeCost(ctx, salsa.id)).toMatchObject({ total: 3.8, perYieldUnit: 0.0019 })
    expect(c.total).toBe(1.13)      // 0,38 + 0,15 + 0,60
    expect(c.perPortion).toBe(0.565)
    expect(c.foodCostPct).toBe(9.42)
    expect(c.lines.find(l => l.kind === 'preparation')?.cost).toBe(0.38)
    expect(c.lines.find(l => l.wastePct === 40)?.grossQty).toBe(300)
  })
  it('bloquea el ciclo al guardar y el desplegable no lo ofrece', () => {
    const salsa = createRecipe(ctx, { name: 'Salsa', kind: 'preparation', yieldQty: 1000, yieldUnit: 'g' })
    const sofrito = createRecipe(ctx, { name: 'Sofrito', kind: 'preparation', yieldQty: 1000, yieldUnit: 'g' })
    addLine(ctx, sofrito.id, { subRecipeId: salsa.id, qty: 100, unit: 'g' })
    expect(() => addLine(ctx, salsa.id, { subRecipeId: sofrito.id, qty: 10, unit: 'g' })).toThrow(/circular/)
    expect(() => addLine(ctx, salsa.id, { subRecipeId: salsa.id, qty: 10, unit: 'g' })).toThrow()
    expect(availablePreparations(ctx, salsa.id).map(p => p.name)).toEqual([])
    expect(availablePreparations(ctx, null).map(p => p.name)).toEqual(['Salsa', 'Sofrito'])
  })
  it('exige producción declarada y unidad compatible para usar una elaboración', () => {
    const base = createRecipe(ctx, { name: 'Base', kind: 'preparation' })
    const plato = createRecipe(ctx, { name: 'Plato' })
    expect(() => addLine(ctx, plato.id, { subRecipeId: base.id, qty: 10, unit: 'g' })).toThrow(/cuánto produce/)
    updateRecipe(ctx, base.id, { yieldQty: 1, yieldUnit: 'l' })
    expect(() => addLine(ctx, plato.id, { subRecipeId: base.id, qty: 10, unit: 'g' })).toThrow(/se produce en l/)
    addLine(ctx, plato.id, { subRecipeId: base.id, qty: 10, unit: 'ml' })
    // Y luego no se puede cambiar la unidad de producción a otra magnitud
    expect(() => updateRecipe(ctx, base.id, { yieldQty: 1000, yieldUnit: 'g' })).toThrow(ConflictError)
  })
  it('editar y borrar líneas; borrar una elaboración en uso la desactiva', () => {
    const salsa = createRecipe(ctx, { name: 'Salsa', kind: 'preparation', yieldQty: 1000, yieldUnit: 'g' })
    const plato = createRecipe(ctx, { name: 'Plato' })
    addLine(ctx, plato.id, { subRecipeId: salsa.id, qty: 100, unit: 'g' })
    const [l] = recipeLines(ctx, plato.id)
    expect(updateLine(ctx, plato.id, l.id, { wastePct: 10 })[0].waste_pct).toBe(10)
    expect(removeRecipe(ctx, salsa.id)).toEqual({ deleted: false })
    removeLine(ctx, plato.id, l.id)
    expect(recipeLines(ctx, plato.id)).toEqual([])
    expect(removeRecipe(ctx, plato.id)).toEqual({ deleted: true })
  })
})

describe('producción', () => {
  it('registra raciones y, si se pide, descuenta del stock los ingredientes reales', () => {
    registerReceipt(ctx, { ingredientId: tomate, warehouseId: null, qty: 10, unitCost: 2, sourceId: 1, occurredAt: '2026-09-01' })
    const salsa = createRecipe(ctx, { name: 'Salsa', kind: 'preparation', yieldQty: 2000, yieldUnit: 'g' })
    addLine(ctx, salsa.id, { ingredientId: tomate, qty: 1500, unit: 'g' })
    const plato = createRecipe(ctx, { name: 'Pasta', portions: 2 })
    addLine(ctx, plato.id, { subRecipeId: salsa.id, qty: 200, unit: 'g' })
    expect(ingredientsToConsume(ctx, plato.id, 10)).toEqual([{ ingredientId: tomate, name: 'Tomate', qty: 0.75, unit: 'kg' }])
    const r = registerProduction(ctx, { recipeId: plato.id, portions: 10, producedOn: '2026-09-02', consumeStock: true })
    expect(r.movements).toBe(1)
    expect(stockLevels(ctx, { ingredientId: tomate })[0].qty).toBe(9.25)
  })
})
