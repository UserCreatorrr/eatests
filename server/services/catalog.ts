// Proveedores e ingredientes: el catálogo del que cuelga todo lo demás.
import { z } from 'zod'
import { nowIso } from '@/server/domain/dates'
import { ConflictError, NotFoundError, ValidationError } from '@/server/domain/errors'
import { parseUnit, type Unit } from '@/server/domain/units'
import type { Ctx } from '@/server/http/context'

// ─── Proveedores ─────────────────────────────────────────────────────────

/** NIF/CIF normalizado: mayúsculas, sin guiones, puntos ni espacios. */
export function normalizeTaxId(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '')
  return s.length >= 5 ? s : null
}

export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Falta el nombre del proveedor').max(160),
  taxId: z.string().trim().max(40).optional().nullable(),
  contactName: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email('Email no válido').max(200).optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().max(12).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  preferredChannel: z.enum(['email', 'whatsapp', 'phone']).optional().nullable(),
  active: z.boolean().optional(),
})
export type SupplierInput = z.infer<typeof supplierSchema>

export interface Supplier {
  id: number; name: string; tax_id: string | null; contact_name: string | null; email: string | null; phone: string | null
  address: string | null; city: string | null; postal_code: string | null; website: string | null; notes: string | null
  preferred_channel: string | null; active: number; created_at: string; updated_at: string
}

const SUPPLIER_COLS = 'id, name, tax_id, contact_name, email, phone, address, city, postal_code, website, notes, preferred_channel, active, created_at, updated_at'

export function listSuppliers(ctx: Ctx, opts: { includeInactive?: boolean } = {}): Supplier[] {
  return ctx.db.prepare(`SELECT ${SUPPLIER_COLS} FROM suppliers WHERE org_id = ? ${opts.includeInactive ? '' : 'AND active = 1'} ORDER BY name COLLATE NOCASE`)
    .all(ctx.orgId) as Supplier[]
}

export function getSupplier(ctx: Ctx, id: number): Supplier {
  const s = ctx.db.prepare(`SELECT ${SUPPLIER_COLS} FROM suppliers WHERE org_id = ? AND id = ?`).get(ctx.orgId, id) as Supplier | undefined
  if (!s) throw new NotFoundError('Proveedor no encontrado')
  return s
}

/** Busca por NIF normalizado y, si no, por nombre exacto (sin mayúsculas). */
export function findSupplier(ctx: Ctx, q: { taxId?: string | null; name?: string | null }): Supplier | null {
  const tax = normalizeTaxId(q.taxId)
  if (tax) {
    const s = ctx.db.prepare(`SELECT ${SUPPLIER_COLS} FROM suppliers WHERE org_id = ? AND tax_id = ?`).get(ctx.orgId, tax) as Supplier | undefined
    if (s) return s
  }
  if (q.name?.trim()) {
    const s = ctx.db.prepare(`SELECT ${SUPPLIER_COLS} FROM suppliers WHERE org_id = ? AND name = ? COLLATE NOCASE`).get(ctx.orgId, q.name.trim()) as Supplier | undefined
    if (s) return s
  }
  return null
}

export function createSupplier(ctx: Ctx, input: unknown): Supplier {
  const d = supplierSchema.parse(input)
  const taxId = normalizeTaxId(d.taxId)
  const dup = findSupplier(ctx, { taxId, name: d.name })
  if (dup) throw new ConflictError(`Ya existe el proveedor "${dup.name}"${dup.tax_id ? ` (NIF ${dup.tax_id})` : ''}`, { supplierId: dup.id })
  const r = ctx.db.prepare(`INSERT INTO suppliers (org_id, name, tax_id, contact_name, email, phone, address, city, postal_code, website, notes, preferred_channel, active)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(ctx.orgId, d.name, taxId, d.contactName ?? null, d.email || null, d.phone ?? null, d.address ?? null, d.city ?? null,
         d.postalCode ?? null, d.website ?? null, d.notes ?? null, d.preferredChannel ?? null, d.active === false ? 0 : 1)
  return getSupplier(ctx, Number(r.lastInsertRowid))
}

/** Devuelve el existente por NIF/nombre o lo crea. Nunca duplica. */
export function ensureSupplier(ctx: Ctx, input: { name: string; taxId?: string | null }): Supplier {
  return findSupplier(ctx, input) ?? createSupplier(ctx, input)
}

export function updateSupplier(ctx: Ctx, id: number, input: unknown): Supplier {
  getSupplier(ctx, id)
  const d = supplierSchema.partial().parse(input)
  const sets: string[] = []; const vals: unknown[] = []
  const map: Record<string, unknown> = {
    name: d.name, tax_id: d.taxId === undefined ? undefined : normalizeTaxId(d.taxId), contact_name: d.contactName,
    email: d.email === '' ? null : d.email, phone: d.phone, address: d.address, city: d.city, postal_code: d.postalCode,
    website: d.website, notes: d.notes, preferred_channel: d.preferredChannel, active: d.active === undefined ? undefined : (d.active ? 1 : 0),
  }
  for (const [k, v] of Object.entries(map)) if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v) }
  if (!sets.length) throw new ValidationError('Nada que actualizar')
  sets.push('updated_at = ?'); vals.push(nowIso())
  ctx.db.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE org_id = ? AND id = ?`).run(...vals, ctx.orgId, id)
  return getSupplier(ctx, id)
}

/** Los proveedores no se borran (tienen documentos): se desactivan. */
export function deactivateSupplier(ctx: Ctx, id: number): void {
  const r = ctx.db.prepare('UPDATE suppliers SET active = 0, updated_at = ? WHERE org_id = ? AND id = ?').run(nowIso(), ctx.orgId, id)
  if (!r.changes) throw new NotFoundError('Proveedor no encontrado')
}

// ─── Ingredientes ────────────────────────────────────────────────────────

const unitField = z.string().transform((v, c) => {
  const u = parseUnit(v)
  if (!u) { c.addIssue({ code: 'custom', message: `La unidad "${v}" no es válida. Usa kg, g, l, ml, cl, ud o docena` }); return z.NEVER }
  return u
})

export const ingredientSchema = z.object({
  name: z.string().trim().min(1, 'Falta el nombre del ingrediente').max(160),
  code: z.string().trim().max(40).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  baseUnit: unitField,
  cost: z.number().min(0, 'El coste no puede ser negativo').max(1e6).optional().nullable(),
  vatRate: z.number().min(0).max(100).optional().nullable(),
  supplierId: z.number().int().positive().optional().nullable(),
  warehouseId: z.number().int().positive().optional().nullable(),
  secondaryWarehouseId: z.number().int().positive().optional().nullable(),
  avgUnitWeightG: z.number().positive().max(100000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  active: z.boolean().optional(),
})
export type IngredientInput = z.infer<typeof ingredientSchema>

export interface Ingredient {
  id: number; code: string | null; name: string; category: string | null; base_unit: Unit; cost: number | null; cost_updated_at: string | null
  vat_rate: number | null; supplier_id: number | null; supplier_name: string | null; warehouse_id: number | null; warehouse_name: string | null
  secondary_warehouse_id: number | null; avg_unit_weight_g: number | null; notes: string | null; active: number; created_at: string; updated_at: string
}

const ING_SELECT = `SELECT i.id, i.code, i.name, i.category, i.base_unit, i.cost, i.cost_updated_at, i.vat_rate, i.supplier_id, s.name AS supplier_name,
                           i.warehouse_id, w.name AS warehouse_name, i.secondary_warehouse_id, i.avg_unit_weight_g, i.notes, i.active, i.created_at, i.updated_at
                    FROM ingredients i
                    LEFT JOIN suppliers s ON s.org_id = i.org_id AND s.id = i.supplier_id
                    LEFT JOIN warehouses w ON w.org_id = i.org_id AND w.id = i.warehouse_id`

export function listIngredients(ctx: Ctx, opts: { includeInactive?: boolean } = {}): Ingredient[] {
  return ctx.db.prepare(`${ING_SELECT} WHERE i.org_id = ? ${opts.includeInactive ? '' : 'AND i.active = 1'} ORDER BY i.name COLLATE NOCASE`)
    .all(ctx.orgId) as Ingredient[]
}

export function getIngredient(ctx: Ctx, id: number): Ingredient {
  const i = ctx.db.prepare(`${ING_SELECT} WHERE i.org_id = ? AND i.id = ?`).get(ctx.orgId, id) as Ingredient | undefined
  if (!i) throw new NotFoundError('Ingrediente no encontrado')
  return i
}

export function findIngredientByName(ctx: Ctx, name: string): Ingredient | null {
  return (ctx.db.prepare(`${ING_SELECT} WHERE i.org_id = ? AND i.name = ? COLLATE NOCASE`).get(ctx.orgId, name.trim()) as Ingredient | undefined) ?? null
}

/** Si tiene proveedor tiene que tener precio: sin precio el food cost sale bajo sin avisar. */
function assertPriceWithSupplier(d: { supplierId?: number | null; cost?: number | null }, current?: Ingredient) {
  const supplier = d.supplierId !== undefined ? d.supplierId : current?.supplier_id
  const cost = d.cost !== undefined ? d.cost : current?.cost
  if (supplier && !(cost && cost > 0)) throw new ValidationError('Si el ingrediente tiene proveedor, necesita un precio de compra')
}

export function createIngredient(ctx: Ctx, input: unknown): Ingredient {
  const d = ingredientSchema.parse(input)
  const dup = findIngredientByName(ctx, d.name)
  if (dup) throw new ConflictError(`Ya existe el ingrediente "${dup.name}"`, { ingredientId: dup.id })
  assertPriceWithSupplier(d)
  const r = ctx.db.prepare(`INSERT INTO ingredients (org_id, code, name, category, base_unit, cost, cost_updated_at, vat_rate, supplier_id, warehouse_id, secondary_warehouse_id, avg_unit_weight_g, notes, active)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(ctx.orgId, d.code ?? null, d.name, d.category ?? null, d.baseUnit, d.cost ?? null, d.cost != null ? nowIso() : null, d.vatRate ?? null,
         d.supplierId ?? null, d.warehouseId ?? null, d.secondaryWarehouseId ?? null, d.avgUnitWeightG ?? null, d.notes ?? null, d.active === false ? 0 : 1)
  return getIngredient(ctx, Number(r.lastInsertRowid))
}

export function updateIngredient(ctx: Ctx, id: number, input: unknown): Ingredient {
  const current = getIngredient(ctx, id)
  const d = ingredientSchema.partial().parse(input)
  assertPriceWithSupplier(d, current)
  if (d.name && d.name.toLowerCase() !== current.name.toLowerCase()) {
    const dup = findIngredientByName(ctx, d.name)
    if (dup && dup.id !== id) throw new ConflictError(`Ya existe el ingrediente "${dup.name}"`, { ingredientId: dup.id })
  }
  const sets: string[] = []; const vals: unknown[] = []
  const map: Record<string, unknown> = {
    code: d.code, name: d.name, category: d.category, base_unit: d.baseUnit, cost: d.cost, vat_rate: d.vatRate, supplier_id: d.supplierId,
    warehouse_id: d.warehouseId, secondary_warehouse_id: d.secondaryWarehouseId, avg_unit_weight_g: d.avgUnitWeightG, notes: d.notes,
    active: d.active === undefined ? undefined : (d.active ? 1 : 0),
  }
  for (const [k, v] of Object.entries(map)) if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v) }
  if (!sets.length) throw new ValidationError('Nada que actualizar')
  if (d.cost !== undefined && d.cost !== current.cost) { sets.push('cost_updated_at = ?'); vals.push(nowIso()) }
  sets.push('updated_at = ?'); vals.push(nowIso())
  ctx.db.prepare(`UPDATE ingredients SET ${sets.join(', ')} WHERE org_id = ? AND id = ?`).run(...vals, ctx.orgId, id)
  return getIngredient(ctx, id)
}

/** Recetas activas que usan el ingrediente (para avisar antes de cambiar unidad o borrar). */
export function recipesUsingIngredient(ctx: Ctx, id: number): { id: number; name: string }[] {
  return ctx.db.prepare(`SELECT DISTINCT r.id, r.name FROM recipe_lines l JOIN recipes r ON r.org_id = l.org_id AND r.id = l.recipe_id
                         WHERE l.org_id = ? AND l.ingredient_id = ? AND r.active = 1 ORDER BY r.name`).all(ctx.orgId, id) as any[]
}

/**
 * Baja de un ingrediente. Si está en recetas se desactiva (el escandallo
 * sigue cuadrando); si no lo usa nada, se borra.
 */
export function removeIngredient(ctx: Ctx, id: number): { deleted: boolean; deactivated: boolean } {
  getIngredient(ctx, id)
  const used = ctx.db.prepare(`SELECT
      (SELECT COUNT(*) FROM recipe_lines WHERE org_id = ? AND ingredient_id = ?) +
      (SELECT COUNT(*) FROM delivery_note_lines WHERE org_id = ? AND ingredient_id = ?) +
      (SELECT COUNT(*) FROM stock_movements WHERE org_id = ? AND ingredient_id = ?) AS n`)
    .get(ctx.orgId, id, ctx.orgId, id, ctx.orgId, id) as any
  if (used.n > 0) {
    ctx.db.prepare('UPDATE ingredients SET active = 0, updated_at = ? WHERE org_id = ? AND id = ?').run(nowIso(), ctx.orgId, id)
    return { deleted: false, deactivated: true }
  }
  ctx.db.prepare('DELETE FROM ingredients WHERE org_id = ? AND id = ?').run(ctx.orgId, id)
  return { deleted: true, deactivated: false }
}

// ─── Precios ─────────────────────────────────────────────────────────────

export interface PriceObservation {
  id: number; ingredient_id: number | null; supplier_id: number | null; supplier_name: string | null; description: string
  qty: number | null; unit: string | null; unit_price: number; previous_price: number | null; observed_on: string; source_type: string; source_id: number | null
}

export function priceHistory(ctx: Ctx, ingredientId: number, limit = 50): PriceObservation[] {
  return ctx.db.prepare(`SELECT p.id, p.ingredient_id, p.supplier_id, s.name AS supplier_name, p.description, p.qty, p.unit, p.unit_price, p.previous_price, p.observed_on, p.source_type, p.source_id
                         FROM price_observations p LEFT JOIN suppliers s ON s.org_id = p.org_id AND s.id = p.supplier_id
                         WHERE p.org_id = ? AND p.ingredient_id = ? ORDER BY p.observed_on DESC, p.id DESC LIMIT ?`)
    .all(ctx.orgId, ingredientId, limit) as PriceObservation[]
}

/**
 * Registra un precio visto y, si procede, actualiza el coste del ingrediente.
 * `unitPrice` ya en la unidad base del ingrediente.
 */
export function recordPrice(ctx: Ctx, p: {
  ingredientId: number; supplierId?: number | null; description?: string; qty?: number | null; unit?: Unit | null
  unitPrice: number; lineTotal?: number | null; observedOn: string; sourceType: 'delivery_note' | 'invoice' | 'manual' | 'import'; sourceId?: number | null
  applyToIngredient: boolean
}): { changedPct: number | null; previous: number | null } {
  const ing = getIngredient(ctx, p.ingredientId)
  const previous = ing.cost
  const changedPct = previous && previous > 0 && Math.abs(p.unitPrice - previous) > 0.00005
    ? Math.round(((p.unitPrice - previous) / previous) * 1000) / 10 : null
  ctx.db.prepare(`INSERT INTO price_observations (org_id, ingredient_id, supplier_id, description, qty, unit, unit_price, line_total, previous_price, observed_on, source_type, source_id)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(ctx.orgId, p.ingredientId, p.supplierId ?? null, p.description ?? ing.name, p.qty ?? null, p.unit ?? null, p.unitPrice, p.lineTotal ?? null,
         previous, p.observedOn, p.sourceType, p.sourceId ?? null)
  if (p.applyToIngredient) {
    ctx.db.prepare('UPDATE ingredients SET cost = ?, cost_updated_at = ?, updated_at = ? WHERE org_id = ? AND id = ?').run(p.unitPrice, nowIso(), nowIso(), ctx.orgId, ing.id)
  }
  return { changedPct, previous }
}
