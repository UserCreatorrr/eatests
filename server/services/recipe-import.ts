// Importación de recetarios Excel: el cliente convierte las hojas a filas
// (SheetJS), aquí se interpretan, se cruzan con el catálogo y, tras la
// revisión, se guardan por el servicio de recetas (mismas reglas que a mano).
import { z } from 'zod'
import { parseRecipeSheet, qtyAndWaste, type Grid, type ImportedRecipe } from '@/server/domain/recipe-import'
import { matchByName, norm } from '@/server/domain/text'
import { baseUnitOf, compatible, parseUnit } from '@/server/domain/units'
import type { Ctx } from '@/server/http/context'
import { createIngredient, listIngredients } from './catalog'
import { addLine, createRecipe, listRecipes } from './recipes'

export const parseSchema = z.object({
  sheets: z.array(z.object({ name: z.string().max(200), rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]).optional())) })).min(1, 'El archivo no contiene hojas legibles').max(200),
})

export interface ReviewLine {
  name: string; unit: string | null; unitRecognized: boolean; grossQty: number | null; netQty: number | null; wastePct: number | null; price: number | null; supplier: string | null; note: string | null
  action: 'link' | 'create'; ingredientId: number | null; ingredientName: string | null; ingredientUnit: string | null; catalogCost: number | null
  match: 'exact' | 'partial' | null; unitMismatch: boolean; hint: string | null; effectiveCost: number | null
}
export interface ReviewRecipe extends Omit<ImportedRecipe, 'lines'> {
  lines: ReviewLine[]; duplicate: boolean
  summary: { lines: number; toLink: number; toCreate: number; noCost: number; partial: number; unitMismatch: number }
}

export function parseSheets(ctx: Ctx, input: unknown): { recipes: ReviewRecipe[]; catalogSize: number } {
  const d = parseSchema.parse(input)
  const catalog = listIngredients(ctx)
  const existing = listRecipes(ctx, { includeInactive: true })
  const names = new Set(existing.map(r => norm(r.name)))
  const codes = new Set(existing.filter(r => r.code).map(r => norm(r.code)))

  const recipes = d.sheets.map(h => {
    const parsed = parseRecipeSheet(h.name, h.rows as Grid)
    const lines: ReviewLine[] = parsed.lines.map(l => {
      const m = matchByName(l.name, catalog)
      const u = parseUnit(l.unit)
      // La receta pide gramos y el catálogo lo vende por unidad: enlazarlo daría
      // un coste sin sentido. Se avisa y no se enlaza automáticamente.
      const unitOk = !m || !u || compatible(u, m.item.base_unit)
      const link = !!m && (unitOk || m.kind === 'exact')
      return {
        name: l.name, unit: l.unit, unitRecognized: !!u, grossQty: l.grossQty, netQty: l.netQty, wastePct: l.wastePct, price: l.price, supplier: l.supplier, note: l.note,
        action: link ? 'link' : 'create', ingredientId: link ? m!.item.id : null, ingredientName: link ? m!.item.name : null, ingredientUnit: link ? m!.item.base_unit : null,
        catalogCost: m?.item.cost ?? null, match: link ? m!.kind : null, unitMismatch: !unitOk,
        hint: !unitOk && m ? `«${m.item.name}» se controla en ${m.item.base_unit} y la receta usa ${l.unit}: no se enlaza para no falsear el coste.` : !u && l.unit ? `Unidad "${l.unit}" no reconocida: elige kg, g, l, ml, ud o docena.` : null,
        effectiveCost: l.price ?? (link ? m!.item.cost : null) ?? null,
      }
    })
    const dup = (!!parsed.name && names.has(norm(parsed.name))) || (!!parsed.code && codes.has(norm(parsed.code)))
    const warnings = [...parsed.warnings]
    if (dup) warnings.push('Ya existe una receta con este nombre o código: al guardar se creará otra distinta.')
    return {
      ...parsed, warnings, lines, duplicate: dup,
      summary: { lines: lines.length, toLink: lines.filter(l => l.action === 'link').length, toCreate: lines.filter(l => l.action === 'create').length,
                 noCost: lines.filter(l => l.effectiveCost == null).length, partial: lines.filter(l => l.match === 'partial').length, unitMismatch: lines.filter(l => l.unitMismatch).length },
    }
  })
  return { recipes, catalogSize: catalog.length }
}

export const commitSchema = z.object({
  recipes: z.array(z.object({
    name: z.string().trim().min(1, 'La receta necesita nombre').max(160),
    code: z.string().trim().max(40).optional().nullable(),
    family: z.string().trim().max(80).optional().nullable(),
    portions: z.number().int().positive().optional().nullable(),
    gramsPerPortion: z.number().positive().optional().nullable(),
    salePrice: z.number().min(0).optional().nullable(),
    description: z.string().max(4000).optional().nullable(),
    allergens: z.string().max(500).optional().nullable(),
    conservation: z.string().max(1000).optional().nullable(),
    regeneration: z.string().max(1000).optional().nullable(),
    notes: z.string().max(4000).optional().nullable(),
    procedure: z.array(z.any()).optional().nullable(),
    lines: z.array(z.object({
      action: z.enum(['link', 'create', 'skip']),
      name: z.string().trim().max(160),
      unit: z.string().optional().nullable(),
      grossQty: z.number().optional().nullable(),
      netQty: z.number().optional().nullable(),
      wastePct: z.number().min(0).max(95).optional().nullable(),
      note: z.string().max(500).optional().nullable(),
      supplier: z.string().max(160).optional().nullable(),
      ingredientId: z.number().int().positive().optional().nullable(),
      effectiveCost: z.number().min(0).optional().nullable(),
    })),
  })).min(1, 'Nada que importar'),
})

export interface ImportResult { recipes: number; lines: number; ingredientsCreated: number; details: { id: number; name: string; lines: number; ingredientsCreated: number; skipped: { name: string; reason: string }[] }[] }

export function commitImport(ctx: Ctx, input: unknown): ImportResult {
  const d = commitSchema.parse(input)
  const result: ImportResult = { recipes: 0, lines: 0, ingredientsCreated: 0, details: [] }
  return ctx.db.transaction(() => {
    for (const r of d.recipes) {
      const recipe = createRecipe(ctx, { name: r.name, code: r.code, category: r.family, portions: r.portions ?? 1, portionWeightG: r.gramsPerPortion, salePrice: r.salePrice,
        description: r.description, allergens: r.allergens, conservation: r.conservation, regeneration: r.regeneration, notes: r.notes, procedure: r.procedure ?? null, source: 'excel' })
      result.recipes++
      const detail = { id: recipe.id, name: recipe.name, lines: 0, ingredientsCreated: 0, skipped: [] as { name: string; reason: string }[] }
      for (const l of r.lines) {
        if (l.action === 'skip' || !l.name) continue
        const u = parseUnit(l.unit)
        if (!u) { detail.skipped.push({ name: l.name, reason: `unidad "${l.unit ?? ''}" no reconocida` }); continue }
        const { qty, wastePct } = qtyAndWaste({ grossQty: l.grossQty ?? null, netQty: l.netQty ?? null, wastePct: l.wastePct ?? null })
        if (!(qty > 0)) { detail.skipped.push({ name: l.name, reason: 'sin cantidad' }); continue }
        let ingredientId = l.ingredientId ?? null
        if (l.action === 'create' && !ingredientId) {
          // El mismo ingrediente en varias recetas del lote se crea una sola vez.
          const existing = listIngredients(ctx, { includeInactive: true }).find(i => norm(i.name) === norm(l.name))
          if (existing) ingredientId = existing.id
          else {
            // La ficha da cantidades en g/ml y precios en €/kg·l: el ingrediente nace en la unidad de COMPRA.
            ingredientId = createIngredient(ctx, { name: l.name, baseUnit: baseUnitOf(u), cost: l.effectiveCost ?? null }).id
            detail.ingredientsCreated++; result.ingredientsCreated++
          }
        }
        try {
          addLine(ctx, recipe.id, ingredientId ? { ingredientId, qty, unit: u, wastePct, note: l.note } : { freeName: l.name, freeUnitCost: l.effectiveCost ?? null, qty, unit: u, wastePct, note: l.note })
          detail.lines++; result.lines++
        } catch (e: any) {
          detail.skipped.push({ name: l.name, reason: e.message })
        }
      }
      result.details.push(detail)
    }
    return result
  })()
}
