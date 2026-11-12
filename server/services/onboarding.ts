// Onboarding: facturas → ingredientes y proveedores; carta → platos; la IA
// propone escandallos con el catálogo extraído; el commit crea todo por los
// servicios normales. Las llamadas a IA se inyectan.
import { z } from 'zod'
import type { Llm, VisionJson } from '@/server/adapters/openai'
import { today } from '@/server/domain/dates'
import { round2, round4 } from '@/server/domain/money'
import { norm } from '@/server/domain/text'
import { baseUnitOf, compatible, conversionFactor, parseUnit, type Unit } from '@/server/domain/units'
import type { Ctx } from '@/server/http/context'
import { createIngredient, ensureSupplier, findIngredientByName, recordPrice, updateIngredient } from './catalog'
import { addLine, createRecipe } from './recipes'

const INVOICE_PROMPT = `Extrae los datos de esta factura o albarán de proveedor. Devuelve JSON:
{ "vendor": "nombre", "vendor_nif": "NIF o null", "fecha": "YYYY-MM-DD o null", "total": número o null,
  "lineas": [ { "nombre": "producto", "cantidad": número, "unidad": "kg|g|l|ml|ud|docena", "precio_unitario": número, "total_linea": número } ] }
Normaliza nombres a singular y sin marca ("TOMATE PERA" → "Tomate pera"). No inventes nada que no se vea.`

const MENU_PROMPT = `Extrae los platos de esta carta de restaurante. Para cada plato: nombre (exacto), categoria ("entrante", "principal", "postre", "bebida", "menu"...), precio_venta (número en euros, null si no se ve), descripcion (corta o "").
Devuelve EXACTAMENTE {"platos": [...]}. No incluyas medias raciones como platos separados. No inventes nada que no se vea.`

export interface ExtractedIngredient { name: string; unit: string | null; unitRecognized: boolean; unitPrice: number; vendor: string | null; date: string | null }

export const imagesSchema = z.object({ images: z.array(z.string().min(50).max(12_000_000)).min(1, 'Sin imágenes').max(20) })

export async function parseInvoices(_ctx: Ctx, input: unknown, vision: VisionJson) {
  const d = imagesSchema.parse(input)
  const docs = await Promise.all(d.images.map(img => vision(INVOICE_PROMPT, [img]).catch(() => ({}))))
  const byName = new Map<string, ExtractedIngredient>()
  for (const doc of docs) {
    for (const l of (Array.isArray(doc?.lineas) ? doc.lineas : []) as any[]) {
      const name = String(l?.nombre ?? '').trim(), price = Number(l?.precio_unitario)
      if (!name || !(price > 0)) continue
      // Último precio visto por nombre normalizado.
      byName.set(norm(name), { name, unit: l.unidad ?? null, unitRecognized: !!parseUnit(l.unidad), unitPrice: price, vendor: doc.vendor ?? null, date: doc.fecha ?? null })
    }
  }
  const suppliers = Array.from(new Map(docs.filter(x => x?.vendor).map(x => [norm(x.vendor), { name: String(x.vendor), taxId: x.vendor_nif ?? null }])).values())
  return { documents: docs, ingredients: Array.from(byName.values()), suppliers }
}

export async function parseMenu(_ctx: Ctx, input: unknown, vision: VisionJson) {
  const d = imagesSchema.parse(input)
  const out = await vision(MENU_PROMPT, d.images)
  const dishes = (Array.isArray(out?.platos) ? out.platos : []).map((p: any) => ({ name: String(p?.nombre ?? '').trim(), category: p?.categoria ?? null, salePrice: p?.precio_venta != null ? Number(p.precio_venta) : null, description: p?.descripcion ?? '' })).filter((p: any) => p.name)
  return { dishes }
}

export const matchSchema = z.object({
  dishes: z.array(z.object({ name: z.string().min(1), category: z.string().optional().nullable(), salePrice: z.number().optional().nullable(), description: z.string().optional().nullable() })).min(1, 'Faltan platos'),
  ingredients: z.array(z.object({ name: z.string().min(1), unit: z.string().optional().nullable(), unitPrice: z.number().min(0), vendor: z.string().optional().nullable() })).min(1, 'Faltan ingredientes'),
})

export interface ProposalLine { ingredient: string; qty: number; unit: Unit; unitPrice: number; cost: number; confidence: 'alta' | 'media' | 'baja' }
export interface Proposal { dish: string; salePrice: number | null; portions: number; lines: ProposalLine[]; total: number; foodCostPct: number | null }

/** Pide a la IA escandallos razonables usando SOLO el catálogo extraído, y cuesta cada línea con unidades normalizadas. */
export async function matchProposals(_ctx: Ctx, input: unknown, llm: Llm): Promise<{ proposals: Proposal[] }> {
  const d = matchSchema.parse(input)
  const catalog = d.ingredients.map((i, idx) => `${idx + 1}. ${i.name} — ${i.unitPrice}€/${i.unit || 'ud'}`).join('\n')
  const proposals: Proposal[] = []
  for (let i = 0; i < d.dishes.length; i += 8) {
    const batch = d.dishes.slice(i, i + 8)
    const dishesStr = batch.map(p => `- ${p.name}${p.salePrice ? ` (PVP ${p.salePrice}€)` : ''}${p.description ? ` — ${p.description}` : ''}`).join('\n')
    const prompt = `Eres un chef profesional que escandalla recetas. Para cada plato, deduce qué ingredientes del CATÁLOGO se usan y con qué cantidad por ración estándar.

CATÁLOGO (precio por unidad):
${catalog}

PLATOS:
${dishesStr}

Por ingrediente: "cantidad" por 1 ración, "unidad" operativa de cocina (sólidos "g", líquidos "ml", piezas "ud"), "confianza" ("alta" si claramente va en el plato, "media" probable, "baja" posible). Por plato: "raciones_estimadas" (normalmente 1).
Reglas: solo ingredientes del catálogo, nombre EXACTO; cantidades realistas (nunca 180 kg de carne); si no hay ingredientes claros, "lineas": [].
Devuelve JSON: {"propuestas": [{"plato": "...", "raciones_estimadas": 1, "lineas": [{"ingrediente": "...", "cantidad": 0, "unidad": "g", "confianza": "alta"}]}]}`
    const r = await llm({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], json: true, maxTokens: 4000, temperature: 0.2 })
    let parsed: any = {}
    try { parsed = JSON.parse(r.content || '{}') } catch { /* sin propuesta */ }
    for (const p of (Array.isArray(parsed?.propuestas) ? parsed.propuestas : []) as any[]) {
      const dish = batch.find(x => norm(x.name) === norm(p?.plato))
      if (!dish) continue
      const lines: ProposalLine[] = []
      for (const l of (Array.isArray(p.lineas) ? p.lineas : []) as any[]) {
        const ing = d.ingredients.find(x => norm(x.name) === norm(l?.ingrediente))
        const u = parseUnit(l?.unidad) ?? parseUnit(ing?.unit) ?? 'ud'
        const qty = Number(l?.cantidad) || 0
        if (!ing || qty <= 0) continue
        const priceUnit = parseUnit(ing.unit) ?? 'ud'
        // Coste real: la línea en g/ml, el precio en €/kg·l.
        const cost = compatible(u, priceUnit) ? qty * conversionFactor(u, priceUnit) * ing.unitPrice : 0
        lines.push({ ingredient: ing.name, qty, unit: u, unitPrice: ing.unitPrice, cost: round4(cost), confidence: ['alta', 'media', 'baja'].includes(l?.confianza) ? l.confianza : 'media' })
      }
      const portions = Number(p?.raciones_estimadas) || 1
      const total = round2(lines.reduce((s, l) => s + l.cost, 0))
      proposals.push({ dish: dish.name, salePrice: dish.salePrice ?? null, portions, lines, total, foodCostPct: dish.salePrice && dish.salePrice > 0 ? Math.round((total / portions / dish.salePrice) * 100) : null })
    }
  }
  return { proposals }
}

export const commitSchema = z.object({
  suppliers: z.array(z.object({ name: z.string().trim().min(1).max(160), taxId: z.string().max(40).optional().nullable() })).optional(),
  ingredients: z.array(z.object({ name: z.string().trim().min(1).max(160), unit: z.string().optional().nullable(), unitPrice: z.number().min(0), vendor: z.string().optional().nullable() })).optional(),
  recipes: z.array(z.object({
    dish: z.string().trim().min(1).max(160), salePrice: z.number().min(0).optional().nullable(), portions: z.number().int().positive().optional(),
    lines: z.array(z.object({ ingredient: z.string().min(1), qty: z.number().positive(), unit: z.string(), unitPrice: z.number().min(0).optional() })),
  })).optional(),
})

export function commitOnboarding(ctx: Ctx, input: unknown) {
  const d = commitSchema.parse(input)
  const summary = { suppliers: { created: 0, existing: 0 }, ingredients: { created: 0, updated: 0, skipped: [] as string[] }, recipes: 0, lines: 0 }
  return ctx.db.transaction(() => {
    const supplierByName = new Map<string, number>()
    for (const s of d.suppliers ?? []) {
      const before = ctx.db.prepare('SELECT COUNT(*) AS c FROM suppliers WHERE org_id = ?').get(ctx.orgId) as { c: number }
      const sup = ensureSupplier(ctx, { name: s.name, taxId: s.taxId })
      const after = ctx.db.prepare('SELECT COUNT(*) AS c FROM suppliers WHERE org_id = ?').get(ctx.orgId) as { c: number }
      if (after.c > before.c) summary.suppliers.created++; else summary.suppliers.existing++
      supplierByName.set(norm(s.name), sup.id)
    }
    for (const i of d.ingredients ?? []) {
      const u = parseUnit(i.unit)
      if (!u) { summary.ingredients.skipped.push(`${i.name}: unidad "${i.unit ?? ''}" no reconocida`); continue }
      const base = baseUnitOf(u)
      const price = round4(i.unitPrice / conversionFactor(u, base))
      const supplierId = i.vendor ? supplierByName.get(norm(i.vendor)) ?? null : null
      const existing = findIngredientByName(ctx, i.name)
      if (existing) {
        if (!compatible(base, existing.base_unit)) { summary.ingredients.skipped.push(`${i.name}: ya existe en ${existing.base_unit}`); continue }
        updateIngredient(ctx, existing.id, { supplierId: supplierId ?? existing.supplier_id })
        recordPrice(ctx, { ingredientId: existing.id, supplierId, unitPrice: round4(price * conversionFactor(base, existing.base_unit)), observedOn: today(), sourceType: 'import', applyToIngredient: true })
        summary.ingredients.updated++
      } else {
        const created = createIngredient(ctx, { name: i.name, baseUnit: base, cost: price, supplierId })
        recordPrice(ctx, { ingredientId: created.id, supplierId, unitPrice: price, observedOn: today(), sourceType: 'import', applyToIngredient: true })
        summary.ingredients.created++
      }
    }
    for (const r of d.recipes ?? []) {
      if (!r.lines.length) continue
      const recipe = createRecipe(ctx, { name: r.dish, portions: r.portions ?? 1, salePrice: r.salePrice ?? null, source: 'ai' })
      summary.recipes++
      for (const l of r.lines) {
        const u = parseUnit(l.unit); if (!u) continue
        const ing = findIngredientByName(ctx, l.ingredient)
        try {
          addLine(ctx, recipe.id, ing && compatible(u, ing.base_unit) ? { ingredientId: ing.id, qty: l.qty, unit: u } : { freeName: l.ingredient, freeUnitCost: l.unitPrice ?? null, qty: l.qty, unit: u })
          summary.lines++
        } catch { /* línea inválida: se omite, el resto de la receta se guarda */ }
      }
    }
    return summary
  })()
}
