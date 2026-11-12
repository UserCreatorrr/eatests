// Importación de recetarios Excel y onboarding (facturas + carta → escandallos).
import { beforeEach, describe, expect, it } from 'vitest'
import { parseRecipeSheet, qtyAndWaste } from '@/server/domain/recipe-import'
import { matchByName, parseNumber } from '@/server/domain/text'
import { createIngredient, listIngredients, priceHistory } from '@/server/services/catalog'
import { commitOnboarding, matchProposals, parseInvoices, parseMenu } from '@/server/services/onboarding'
import { commitImport, parseSheets } from '@/server/services/recipe-import'
import { listRecipes, recipeCost, recipeLines } from '@/server/services/recipes'
import type { Ctx } from '@/server/http/context'
import { testCtx } from '../helpers'

let ctx: Ctx
beforeEach(() => { ctx = testCtx() })

const SHEET = [
  ['CONNATURA', 'CONNATURA', 'CONNATURA', 'CONNATURA', 'CONNATURA'],
  ['Crema de calabaza'],
  ['Código', 'R-012', null, 'Familia', 'Entrantes'],
  ['Producción base', '10 porciones', null, 'Precio objetivo / porción', '6,50 €'],
  ['Gramos / porción', 250],
  [],
  ['Ingrediente', 'Unidad', 'Cantidad bruta', 'Merma', 'Cantidad neta', 'Precio', 'Proveedor'],
  ['Calabaza', 'g', 2000, '0,05', 1900, '1,20', 'Verduras Paco'],
  ['Nata', 'ml', 500, null, 500, null, null],
  ['Sal', 'pizca', 1, null, 1, null, null],
  ['Total', null, null],
  [],
  ['Paso', 'Etapa', 'Procedimiento', 'Tiempo'],
  [1, 'Preparación', 'Pelar y trocear la calabaza', '10 min'],
  [2, 'Cocción', 'Cocer 25 minutos', '25 min'],
  ['Conservación', '3 días en cámara'],
]

describe('lectura de ficha técnica', () => {
  it('detecta nombre, cabecera por etiqueta, tabla de ingredientes y procedimiento', () => {
    const r = parseRecipeSheet('R-012', SHEET as any)
    expect(r).toMatchObject({ name: 'Crema de calabaza', code: 'R-012', family: 'Entrantes', portions: 10, salePrice: 6.5, gramsPerPortion: 250, conservation: '3 días en cámara' })
    expect(r.lines).toHaveLength(3)
    expect(r.lines[0]).toMatchObject({ name: 'Calabaza', unit: 'g', grossQty: 2000, wastePct: 5, netQty: 1900, price: 1.2, supplier: 'Verduras Paco' })
    expect(r.procedure).toHaveLength(2)
    expect(r.procedure[1]).toMatchObject({ step: '2', stage: 'Cocción', text: 'Cocer 25 minutos' })
    expect(r.warnings.some(w => /sin precio/.test(w))).toBe(true)
  })
  it('cantidad y merma: con neta y merma se guardan ambas; con solo bruta, merma 0', () => {
    expect(qtyAndWaste({ grossQty: 2000, netQty: 1900, wastePct: 5 })).toEqual({ qty: 1900, wastePct: 5 })
    expect(qtyAndWaste({ grossQty: 2000, netQty: null, wastePct: 5 })).toEqual({ qty: 2000, wastePct: 0 })
    expect(parseNumber('1.450,80')).toBe(1450.8)
    expect(matchByName('tomate pera', [{ name: 'Tomate' }, { name: 'Tomate pera rama' }])?.item.name).toBe('Tomate pera rama')
  })
})

describe('importación de recetario', () => {
  it('cruza con el catálogo, avisa de unidades incompatibles y guarda por el servicio de recetas', () => {
    createIngredient(ctx, { name: 'Calabaza', baseUnit: 'kg', cost: 1 })
    createIngredient(ctx, { name: 'Nata', baseUnit: 'ud', cost: 2 })
    const p = parseSheets(ctx, { sheets: [{ name: 'R-012', rows: SHEET }] })
    const r = p.recipes[0]
    expect(r.lines[0]).toMatchObject({ action: 'link', ingredientName: 'Calabaza', match: 'exact', effectiveCost: 1.2 })
    // Nata exacta pero en ud frente a ml: se enlaza por ser exacta, con aviso de unidad.
    expect(r.lines[1]).toMatchObject({ action: 'link', unitMismatch: true })
    expect(r.lines[2]).toMatchObject({ action: 'create', unitRecognized: false })
    expect(r.summary).toMatchObject({ lines: 3, toLink: 2, toCreate: 1, unitMismatch: 1 })

    const c = commitImport(ctx, { recipes: [{ name: r.name!, code: r.code, family: r.family, portions: r.portions, salePrice: r.salePrice, gramsPerPortion: r.gramsPerPortion,
      lines: [
        { action: 'link', name: 'Calabaza', unit: 'g', grossQty: 2000, netQty: 1900, wastePct: 5, ingredientId: 1, effectiveCost: 1.2 },
        { action: 'create', name: 'Nata líquida', unit: 'ml', grossQty: 500, netQty: 500, effectiveCost: 3 },
        { action: 'create', name: 'Sal', unit: 'pizca', grossQty: 1 },
      ] }] })
    expect(c).toMatchObject({ recipes: 1, lines: 2, ingredientsCreated: 1 })
    expect(c.details[0].skipped[0]).toMatchObject({ name: 'Sal' })
    const recipe = listRecipes(ctx)[0]
    expect(recipe).toMatchObject({ name: 'Crema de calabaza', code: 'R-012', portions: 10, sale_price: 6.5, source: 'excel' })
    const lines = recipeLines(ctx, recipe.id)
    expect(lines[0]).toMatchObject({ qty: 1900, unit: 'g', waste_pct: 5 })
    expect(listIngredients(ctx).find(i => i.name === 'Nata líquida')).toMatchObject({ base_unit: 'l', cost: 3 })
    // Coste: calabaza 1,9 kg / 0,95 × 1 €/kg = 2 €; nata 0,5 l × 3 = 1,5 € → 3,5 € / 10 = 0,35 €/ración
    expect(recipeCost(ctx, recipe.id)).toMatchObject({ total: 3.5, perPortion: 0.35 })
  })
})

describe('onboarding', () => {
  const vision = async (prompt: string) => prompt.includes('carta')
    ? { platos: [{ nombre: 'Pollo al curry', categoria: 'principal', precio_venta: 12, descripcion: '' }, { nombre: '' }] }
    : { vendor: 'Makro', vendor_nif: 'A28647451', fecha: '2026-11-01', total: 100, lineas: [{ nombre: 'Pollo', cantidad: 10, unidad: 'kg', precio_unitario: 6 }, { nombre: 'Curry', cantidad: 100, unidad: 'g', precio_unitario: 0.02 }, { nombre: 'Gratis', precio_unitario: 0 }] }
  it('facturas → ingredientes y proveedores; carta → platos; IA → propuestas costeadas; commit crea todo', async () => {
    const img = 'data:image/jpeg;base64,' + 'x'.repeat(80)
    const inv = await parseInvoices(ctx, { images: [img, img] }, vision)
    expect(inv.ingredients.map(i => i.name)).toEqual(['Pollo', 'Curry'])
    expect(inv.suppliers).toEqual([{ name: 'Makro', taxId: 'A28647451' }])
    const menu = await parseMenu(ctx, { images: [img] }, vision)
    expect(menu.dishes).toEqual([{ name: 'Pollo al curry', category: 'principal', salePrice: 12, description: '' }])

    const llm = async () => ({ content: JSON.stringify({ propuestas: [{ plato: 'Pollo al curry', raciones_estimadas: 1, lineas: [{ ingrediente: 'Pollo', cantidad: 200, unidad: 'g', confianza: 'alta' }, { ingrediente: 'Curry', cantidad: 5, unidad: 'g', confianza: 'media' }, { ingrediente: 'Inventado', cantidad: 1, unidad: 'g' }] }] }), toolCalls: [], finishReason: 'stop' })
    const m = await matchProposals(ctx, { dishes: menu.dishes, ingredients: inv.ingredients }, llm)
    expect(m.proposals[0]).toMatchObject({ dish: 'Pollo al curry', total: 1.3, foodCostPct: 11 })
    expect(m.proposals[0].lines).toHaveLength(2)

    const s = commitOnboarding(ctx, { suppliers: inv.suppliers, ingredients: inv.ingredients, recipes: m.proposals })
    expect(s).toMatchObject({ suppliers: { created: 1 }, ingredients: { created: 2 }, recipes: 1, lines: 2 })
    const curry = listIngredients(ctx).find(i => i.name === 'Curry')!
    // 0,02 €/g → 20 €/kg, en unidad de compra.
    expect(curry).toMatchObject({ base_unit: 'kg', cost: 20, supplier_id: 1 })
    expect(priceHistory(ctx, curry.id)).toHaveLength(1)
    expect(recipeCost(ctx, listRecipes(ctx)[0].id)).toMatchObject({ total: 1.3, foodCostPct: 10.83 })
  })
})
