import { beforeEach, describe, expect, it } from 'vitest'
import { ConflictError, NotFoundError, ValidationError } from '@/server/domain/errors'
import type { Ctx } from '@/server/http/context'
import { createIngredient, createSupplier, ensureSupplier, findSupplier, getIngredient, normalizeTaxId, priceHistory, recordPrice, removeIngredient, updateIngredient } from '@/server/services/catalog'
import { testCtx } from '../helpers'

let ctx: Ctx
beforeEach(() => { ctx = testCtx() })

describe('proveedores', () => {
  it('normaliza el NIF y no deja duplicar por NIF ni por nombre', () => {
    expect(normalizeTaxId('a-28/647451')).toBe('A28647451')
    const s = createSupplier(ctx, { name: 'Makro', taxId: 'A-28/647451' })
    expect(s.tax_id).toBe('A28647451')
    expect(() => createSupplier(ctx, { name: 'Makro Distribución', taxId: 'a28647451' })).toThrow(ConflictError)
    expect(() => createSupplier(ctx, { name: 'MAKRO' })).toThrow(ConflictError)
    expect(findSupplier(ctx, { taxId: 'A28647451' })?.id).toBe(s.id)
    expect(ensureSupplier(ctx, { name: 'otro nombre', taxId: 'A28647451' }).id).toBe(s.id)
    expect(ensureSupplier(ctx, { name: 'Prodesco' }).id).not.toBe(s.id)
  })
  it('valida la entrada', () => {
    expect(() => createSupplier(ctx, { name: '  ' })).toThrow()
    expect(() => createSupplier(ctx, { name: 'X', email: 'no-email' })).toThrow()
  })
})

describe('ingredientes', () => {
  it('exige unidad del catálogo y normaliza variantes', () => {
    const i = createIngredient(ctx, { name: 'Tomate', baseUnit: 'Kg', cost: 2.1 })
    expect(i.base_unit).toBe('kg')
    expect(() => createIngredient(ctx, { name: 'Perejil', baseUnit: 'Manojo' })).toThrow(/no es válida/)
  })
  it('no duplica nombres y exige precio si hay proveedor', () => {
    const s = createSupplier(ctx, { name: 'Makro' })
    createIngredient(ctx, { name: 'Tomate', baseUnit: 'kg', cost: 2 })
    expect(() => createIngredient(ctx, { name: 'tomate', baseUnit: 'kg' })).toThrow(ConflictError)
    expect(() => createIngredient(ctx, { name: 'Ajo', baseUnit: 'kg', supplierId: s.id })).toThrow(/necesita un precio/)
    const ajo = createIngredient(ctx, { name: 'Ajo', baseUnit: 'kg' })
    expect(() => updateIngredient(ctx, ajo.id, { supplierId: s.id })).toThrow(ValidationError)
    expect(updateIngredient(ctx, ajo.id, { supplierId: s.id, cost: 6.8 }).supplier_name).toBe('Makro')
  })
  it('no ve ingredientes de otra organización', () => {
    const other = testCtx(ctx.db, 'Otra')
    const i = createIngredient(ctx, { name: 'Secreto', baseUnit: 'kg' })
    expect(() => getIngredient(other, i.id)).toThrow(NotFoundError)
    expect(() => updateIngredient(other, i.id, { cost: 1 })).toThrow(NotFoundError)
  })
  it('se desactiva si está en uso y se borra si no', () => {
    const i = createIngredient(ctx, { name: 'Tomate', baseUnit: 'kg', cost: 2 })
    expect(removeIngredient(ctx, i.id)).toEqual({ deleted: true, deactivated: false })
    const j = createIngredient(ctx, { name: 'Ajo', baseUnit: 'kg', cost: 6 })
    ctx.db.prepare(`INSERT INTO recipes (org_id, name) VALUES (?, 'Plato')`).run(ctx.orgId)
    ctx.db.prepare(`INSERT INTO recipe_lines (org_id, recipe_id, ingredient_id, qty, unit) VALUES (?, 1, ?, 10, 'g')`).run(ctx.orgId, j.id)
    expect(removeIngredient(ctx, j.id)).toEqual({ deleted: false, deactivated: true })
    expect(getIngredient(ctx, j.id).active).toBe(0)
  })
})

describe('precios', () => {
  it('guarda el histórico con el precio anterior y el cambio', () => {
    const i = createIngredient(ctx, { name: 'Pechuga', baseUnit: 'kg', cost: 6.2 })
    const r = recordPrice(ctx, { ingredientId: i.id, unitPrice: 8.5, observedOn: '2026-08-15', sourceType: 'manual', applyToIngredient: true })
    expect(r).toEqual({ changedPct: 37.1, previous: 6.2 })
    expect(getIngredient(ctx, i.id).cost).toBe(8.5)
    const h = priceHistory(ctx, i.id)
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({ unit_price: 8.5, previous_price: 6.2, observed_on: '2026-08-15' })
    recordPrice(ctx, { ingredientId: i.id, unitPrice: 9, observedOn: '2026-08-16', sourceType: 'manual', applyToIngredient: false })
    expect(getIngredient(ctx, i.id).cost).toBe(8.5)
  })
})
