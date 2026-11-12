// Escaneo de albaranes y facturas: la IA extrae, el servicio cruza con el
// catálogo y el usuario valida. Nada se guarda hasta el commit, y el commit
// pasa por el mismo camino que un albarán a mano (purchasing), así que
// precios, stock y recetas afectadas salen de un único sitio.
import { z } from 'zod'
import type { VisionJson } from '@/server/adapters/openai'
import { parseDate, today } from '@/server/domain/dates'
import { ValidationError } from '@/server/domain/errors'
import { round2, round4, toCents } from '@/server/domain/money'
import { matchByName, norm } from '@/server/domain/text'
import { baseUnitOf, compatible, conversionFactor, parseUnit } from '@/server/domain/units'
import type { Ctx } from '@/server/http/context'
import { createIngredient, ensureSupplier, findSupplier, listIngredients, listSuppliers, normalizeTaxId, type Ingredient } from './catalog'
import { createDeliveryNote, createInvoice, validateDeliveryNote, type ValidationResult } from './purchasing'

export const EXTRACT_PROMPT = (kind: 'delivery_note' | 'invoice') => `Extrae los datos de este ${kind === 'invoice' ? 'factura' : 'albarán'} de proveedor. Devuelve JSON:
{
  "vendor": "nombre del proveedor",
  "vendor_nif": "NIF/CIF si aparece, sino null",
  "doc_num": "número de documento si aparece, sino null",
  "fecha": "YYYY-MM-DD si se ve, sino null",
  "fecha_vencimiento": "YYYY-MM-DD si es factura y se ve, sino null",
  "base": número o null,
  "iva": número (importe IVA total del documento) o null,
  "total": número o null,
  "lineas": [
    { "nombre": "producto", "cantidad": número, "unidad": "kg|g|l|ml|ud|docena", "precio_unitario": número, "total_linea": número, "iva_pct": número (0|4|10|21) si aparece, sino null }
  ]
}
Normaliza nombres a singular sin marca. Para iva_pct usa el porcentaje, no el importe. No inventes nada que no se vea.`

export interface ScannedLine {
  description: string; qty: number | null; unit: string | null; unitRecognized: boolean; unitPrice: number | null; lineTotal: number | null; vatRate: number | null
  ingredientId: number | null; ingredientName: string | null; ingredientUnit: string | null; currentCost: number | null; match: 'exact' | 'partial' | null
  unitPriceInBase: number | null; changePct: number | null; unitMismatch: boolean
}

export interface ScanResult {
  kind: 'delivery_note' | 'invoice'
  header: { vendor: string | null; vendorTaxId: string | null; supplierId: number | null; supplierName: string | null; number: string | null; date: string | null; dueDate: string | null; base: number | null; vat: number | null; total: number | null }
  lines: ScannedLine[]
  reconcile: { linesSum: number; base: number | null; vat: number | null; total: number | null; gap: number | null }
  warnings: { unmapped: number; priceChanges: number; newSupplier: boolean; noVat: number; gap: boolean; unitMismatch: number }
}

export const scanSchema = z.object({ image: z.string().min(50).max(12_000_000), kind: z.enum(['delivery_note', 'invoice']).optional() })

/** Lee un documento con visión y lo cruza con el catálogo. No escribe nada. */
export async function scanDocument(ctx: Ctx, input: unknown, vision: VisionJson): Promise<ScanResult> {
  const d = scanSchema.parse(input)
  const kind = d.kind ?? 'delivery_note'
  const raw = await vision(EXTRACT_PROMPT(kind), [d.image])
  return mapExtracted(ctx, kind, raw ?? {})
}

/** Cruce puro de un documento ya extraído (también lo usa el chat). */
export function mapExtracted(ctx: Ctx, kind: 'delivery_note' | 'invoice', raw: any): ScanResult {
  const ingredients = listIngredients(ctx)
  const supplier = findSupplier(ctx, { taxId: raw.vendor_nif, name: raw.vendor })
  const lines: ScannedLine[] = (Array.isArray(raw.lineas) ? raw.lineas : []).map((l: any): ScannedLine => {
    const description = String(l.nombre ?? '').trim()
    const m = description ? matchByName(description, ingredients) : null
    const ing: Ingredient | null = m?.item ?? null
    const unit = l.unidad ? String(l.unidad) : null
    const u = parseUnit(unit)
    const unitPrice = l.precio_unitario != null && Number.isFinite(Number(l.precio_unitario)) ? Number(l.precio_unitario) : null
    let unitPriceInBase: number | null = null, changePct: number | null = null, unitMismatch = false
    if (ing && u) {
      if (compatible(u, ing.base_unit)) {
        if (unitPrice != null) {
          unitPriceInBase = round4(unitPrice / conversionFactor(u, ing.base_unit))
          if (ing.cost && ing.cost > 0 && Math.abs(unitPriceInBase - ing.cost) > 0.00005) changePct = Math.round(((unitPriceInBase - ing.cost) / ing.cost) * 1000) / 10
        }
      } else unitMismatch = true
    }
    return {
      description, qty: l.cantidad != null ? Number(l.cantidad) : null, unit, unitRecognized: !!u, unitPrice, lineTotal: l.total_linea != null ? Number(l.total_linea) : null,
      vatRate: l.iva_pct != null ? Number(l.iva_pct) : ing?.vat_rate ?? null,
      ingredientId: ing?.id ?? null, ingredientName: ing?.name ?? null, ingredientUnit: ing?.base_unit ?? null, currentCost: ing?.cost ?? null, match: m?.kind ?? null,
      unitPriceInBase, changePct, unitMismatch,
    }
  })
  const linesSum = round2(lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0))
  const num = (v: any) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null)
  const base = num(raw.base), vat = num(raw.iva), total = num(raw.total)
  const gap = base != null && vat != null && total != null ? round2(base + vat - total) : null
  return {
    kind,
    header: { vendor: raw.vendor ?? null, vendorTaxId: normalizeTaxId(raw.vendor_nif), supplierId: supplier?.id ?? null, supplierName: supplier?.name ?? null,
              number: raw.doc_num ?? null, date: parseDate(raw.fecha) ?? null, dueDate: parseDate(raw.fecha_vencimiento) ?? null, base, vat, total },
    lines,
    reconcile: { linesSum, base, vat, total, gap },
    warnings: { unmapped: lines.filter(l => !l.ingredientId).length, priceChanges: lines.filter(l => l.changePct != null).length, newSupplier: !supplier,
                noVat: lines.filter(l => l.vatRate == null).length, gap: gap != null && Math.abs(gap) > 0.02, unitMismatch: lines.filter(l => l.unitMismatch).length },
  }
}

const unitField = z.string().transform((v, c) => { const u = parseUnit(v); if (!u) { c.addIssue({ code: 'custom', message: `Unidad no válida: ${v}` }); return z.NEVER } return u })

export const commitSchema = z.object({
  kind: z.enum(['delivery_note', 'invoice']),
  header: z.object({
    supplierId: z.number().int().positive().optional().nullable(),
    vendor: z.string().trim().max(160).optional().nullable(),
    vendorTaxId: z.string().trim().max(40).optional().nullable(),
    number: z.string().trim().max(60).optional().nullable(),
    date: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    base: z.number().min(0).optional().nullable(),
    vat: z.number().min(0).optional().nullable(),
    total: z.number().min(0).optional().nullable(),
  }),
  lines: z.array(z.object({
    excluded: z.boolean().optional(),
    description: z.string().trim().min(1).max(200),
    qty: z.number().positive().optional().nullable(),
    unit: unitField.optional().nullable(),
    unitPrice: z.number().min(0).optional().nullable(),
    lineTotal: z.number().min(0).optional().nullable(),
    vatRate: z.number().min(0).max(100).optional().nullable(),
    ingredientId: z.number().int().positive().optional().nullable(),
    /** Alta del ingrediente desde la validación, con los datos elegidos ahí mismo. */
    create: z.object({ category: z.string().trim().max(80).optional().nullable(), vatRate: z.number().min(0).max(100).optional().nullable(), warehouseId: z.number().int().positive().optional().nullable() }).optional().nullable(),
  })),
  image: z.string().max(12_000_000).optional().nullable(),
  applyPrices: z.boolean().optional(),
  createSupplier: z.boolean().optional(),
  /** Solo facturas: agrupar albaranes ya validados en vez de crear líneas. */
  deliveryNoteIds: z.array(z.number().int().positive()).optional(),
  force: z.boolean().optional(),
})

export interface CommitResult {
  kind: 'delivery_note' | 'invoice'
  deliveryNoteId: number | null
  invoiceId: number | null
  number: string
  status: string
  supplierId: number
  lines: number
  ingredientsCreated: number
  validation: ValidationResult | null
  pendingLines: number
}

export function storeImage(ctx: Ctx, dataUrl: string): number {
  const m = /^data:([\w/+.-]+);base64,([\s\S]+)$/.exec(dataUrl)
  if (!m) throw new ValidationError('La imagen debe ser un data URL en base64')
  const bytes = Math.floor((m[2].length * 3) / 4)
  if (bytes > 8_000_000) throw new ValidationError('La imagen supera los 8 MB')
  const r = ctx.db.prepare('INSERT INTO document_images (org_id, mime, data, bytes) VALUES (?, ?, ?, ?)').run(ctx.orgId, m[1], dataUrl, bytes)
  return Number(r.lastInsertRowid)
}

/**
 * Guarda el documento validado. Un albarán se crea y se valida (precios,
 * stock, recetas afectadas). Una factura escaneada con líneas nace como
 * albarán validado + factura que lo agrupa: así el gasto y el stock salen
 * de la misma tabla que el resto. Si quedan líneas sin resolver, el albarán
 * se queda en revisión y se dice.
 */
export function commitDocument(ctx: Ctx, input: unknown): CommitResult {
  const d = commitSchema.parse(input)
  const active = d.lines.filter(l => !l.excluded)
  if (d.kind === 'delivery_note' && active.length === 0) throw new ValidationError('El albarán no tiene líneas: añade al menos un producto antes de validarlo')
  if (d.kind === 'invoice' && active.length === 0 && !(d.deliveryNoteIds?.length)) throw new ValidationError('La factura no tiene líneas ni albaranes que agrupar')

  return ctx.db.transaction((): CommitResult => {
    // Proveedor: el elegido, el que casa por NIF o nombre, o uno nuevo si se pidió.
    let supplierId = d.header.supplierId ?? null
    if (!supplierId) {
      const found = findSupplier(ctx, { taxId: d.header.vendorTaxId, name: d.header.vendor })
      if (found) supplierId = found.id
      else if (d.createSupplier && d.header.vendor) supplierId = ensureSupplier(ctx, { name: d.header.vendor, taxId: d.header.vendorTaxId }).id
      else throw new ValidationError('Elige el proveedor o marca "crear proveedor"')
    }
    const imageId = d.image ? storeImage(ctx, d.image) : null
    let ingredientsCreated = 0
    const lines = active.map(l => {
      let ingredientId = l.ingredientId ?? null
      if (!ingredientId && l.create) {
        const unit = l.unit ?? 'ud'
        const existing = listIngredients(ctx, { includeInactive: true }).find(i => norm(i.name) === norm(l.description))
        if (existing) ingredientId = existing.id
        else {
          // Nace con el precio del documento en su unidad base; sin precio no se
          // le asigna proveedor (la regla "con proveedor, con precio" lo exige).
          const base = baseUnitOf(unit)
          const cost = l.unitPrice != null && l.unit ? round4(l.unitPrice / conversionFactor(l.unit, base)) : null
          ingredientId = createIngredient(ctx, { name: l.description, baseUnit: base, category: l.create.category ?? null, vatRate: l.create.vatRate ?? l.vatRate ?? null,
                                                 supplierId: cost ? supplierId : null, warehouseId: l.create.warehouseId ?? null, cost }).id
          ingredientsCreated++
        }
      }
      return { ingredientId, description: l.description, qty: l.qty ?? null, unit: l.unit ?? null, unitPrice: l.unitPrice ?? null, lineTotal: l.lineTotal ?? null, vatRate: l.vatRate ?? null }
    })
    const pendingLines = lines.filter(l => !l.ingredientId).length
    const date = d.header.date ?? today()

    let deliveryNoteId: number | null = null, validation: ValidationResult | null = null, status = 'draft', number = ''
    if (lines.length) {
      const note = createDeliveryNote(ctx, { supplierId, number: d.header.number, deliveryDate: date, base: d.header.base, vat: d.header.vat, total: d.header.total, imageId: d.kind === 'delivery_note' ? imageId : null, source: 'scan', lines })
      deliveryNoteId = note.id; number = note.number; status = note.status
      if (pendingLines === 0) {
        validation = validateDeliveryNote(ctx, note.id, { applyPrices: d.applyPrices !== false, force: d.force })
        status = validation.note.status
      } else {
        ctx.db.prepare(`UPDATE delivery_notes SET status = 'review', updated_at = ? WHERE org_id = ? AND id = ?`).run(new Date().toISOString(), ctx.orgId, note.id)
        status = 'review'
        ctx.db.prepare(`INSERT INTO notifications (org_id, user_id, type, title, body, urgency, link) VALUES (?, ?, 'validacion', ?, ?, 'high', ?)`)
          .run(ctx.orgId, ctx.userId, `${note.number} guardado con ${pendingLines} línea(s) sin mapear`, 'Queda en revisión: esas líneas no actualizan costes ni stock hasta resolverse.', `/dashboard/compras/albaranes/${note.id}`)
      }
    }
    let invoiceId: number | null = null
    if (d.kind === 'invoice') {
      if (!d.header.number) throw new ValidationError('Falta el número de factura')
      const ids = [...(d.deliveryNoteIds ?? []), ...(deliveryNoteId && status === 'validated' ? [deliveryNoteId] : [])]
      const inv = createInvoice(ctx, { supplierId, number: d.header.number, invoiceDate: date, dueDate: d.header.dueDate, base: d.header.base, vat: d.header.vat, total: d.header.total, imageId, source: 'scan', deliveryNoteIds: ids })
      invoiceId = inv.id; number = inv.number; if (!deliveryNoteId) status = inv.status
    }
    if (validation && validation.priceChanges.length) {
      ctx.db.prepare(`INSERT INTO notifications (org_id, user_id, type, title, body, urgency, link) VALUES (?, ?, 'precio', ?, ?, ?, ?)`)
        .run(ctx.orgId, ctx.userId, `${validation.pricesUpdated} precio(s) actualizados desde ${number}`,
             validation.affectedRecipes.length ? `${validation.affectedRecipes.length} escandallo(s) afectados por el cambio de coste. Revisa el food cost.` : 'Costes de ingredientes actualizados con el documento.',
             validation.affectedRecipes.length ? 'high' : 'normal', d.kind === 'invoice' ? `/dashboard/compras/facturas/${invoiceId}` : `/dashboard/compras/albaranes/${deliveryNoteId}`)
    }
    return { kind: d.kind, deliveryNoteId, invoiceId, number, status, supplierId, lines: lines.length, ingredientsCreated, validation, pendingLines }
  })()
}

export { toCents, listSuppliers }
