// Compras: pedidos, albaranes y facturas. Aquí viven el ciclo del documento
// (Sprint 1 de Steven) y las reglas que la BD no puede expresar sola.
//
//  pedido  draft → sent → received (genera albarán con sus líneas) → closed
//  albarán draft/review → validated (líneas mapeadas, suma = base) → invoiced
//  factura agrupa albaranes validados del mismo proveedor; base = Σ albaranes
import { z } from 'zod'
import { isIsoDate, nowIso, parseDate, today } from '@/server/domain/dates'
import { ConflictError, NotFoundError, ValidationError } from '@/server/domain/errors'
import { amountsReconcile, toCents } from '@/server/domain/money'
import { assertDeliveryNoteTransition, assertInvoiceTransition, assertOrderTransition, type DeliveryNoteStatus, type OrderStatus } from '@/server/domain/states'
import { compatible, conversionFactor, parseUnit, type Unit } from '@/server/domain/units'
import type { Ctx } from '@/server/http/context'
import { ensureSupplier, getIngredient, getSupplier, recordPrice } from './catalog'
import { registerReceipt } from './stock'

const dateField = z.string().transform((v, c) => {
  const d = parseDate(v)
  if (!d) { c.addIssue({ code: 'custom', message: `Fecha no válida: ${v}` }); return z.NEVER }
  return d
})
const unitField = z.string().transform((v, c) => {
  const u = parseUnit(v)
  if (!u) { c.addIssue({ code: 'custom', message: `Unidad no válida: ${v}` }); return z.NEVER }
  return u
})
const money = z.number().min(0).max(1e8)

// ─── Numeración ─────────────────────────────────────────────────────────

function nextNumber(ctx: Ctx, table: 'purchase_orders' | 'delivery_notes' | 'invoices', prefix: string): string {
  const ymd = today().replace(/-/g, '')
  const n = (ctx.db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE org_id = ? AND number LIKE ?`).get(ctx.orgId, `${prefix}-${ymd}-%`) as any).c
  return `${prefix}-${ymd}-${String(n + 1).padStart(3, '0')}`
}

// ─── Pedidos ────────────────────────────────────────────────────────────

export const orderLineSchema = z.object({
  ingredientId: z.number().int().positive().optional().nullable(),
  description: z.string().trim().max(200).optional().nullable(),
  qty: z.number().positive('La cantidad debe ser mayor que 0').max(1e6),
  unit: unitField.optional().nullable(),
  unitCostEstimate: money.optional().nullable(),
  warehouseId: z.number().int().positive().optional().nullable(),
})
export const orderSchema = z.object({
  supplierId: z.number().int().positive(),
  number: z.string().trim().max(40).optional().nullable(),
  orderDate: dateField.optional().nullable(),
  expectedDate: dateField.optional().nullable(),
  locationId: z.number().int().positive().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(orderLineSchema).optional(),
})

export interface Order {
  id: number; number: string; supplier_id: number; supplier_name: string; location_id: number | null; status: OrderStatus
  order_date: string; expected_date: string | null; sent_at: string | null; sent_via: string | null; notes: string | null
  total: number; line_count: number; created_at: string; updated_at: string
}
export interface OrderLine {
  id: number; ingredient_id: number | null; description: string; qty: number; unit: Unit; unit_cost_estimate: number | null
  current_unit_cost: number | null; line_total: number; warehouse_id: number | null; sort_order: number
}

const ORDER_SELECT = `SELECT o.id, o.number, o.supplier_id, s.name AS supplier_name, o.location_id, o.status, o.order_date, o.expected_date, o.sent_at, o.sent_via, o.notes,
  o.created_at, o.updated_at,
  COALESCE((SELECT SUM(l.qty * COALESCE(l.unit_cost_estimate, 0)) FROM purchase_order_lines l WHERE l.org_id = o.org_id AND l.order_id = o.id), o.declared_total_cents / 100.0, 0) AS total,
  (SELECT COUNT(*) FROM purchase_order_lines l WHERE l.org_id = o.org_id AND l.order_id = o.id) AS line_count
  FROM purchase_orders o JOIN suppliers s ON s.org_id = o.org_id AND s.id = o.supplier_id`

export function listOrders(ctx: Ctx, opts: { status?: OrderStatus } = {}): Order[] {
  return ctx.db.prepare(`${ORDER_SELECT} WHERE o.org_id = ? ${opts.status ? 'AND o.status = ?' : ''} ORDER BY o.order_date DESC, o.id DESC`)
    .all(...(opts.status ? [ctx.orgId, opts.status] : [ctx.orgId])) as Order[]
}

export function getOrder(ctx: Ctx, id: number): Order & { lines: OrderLine[] } {
  const o = ctx.db.prepare(`${ORDER_SELECT} WHERE o.org_id = ? AND o.id = ?`).get(ctx.orgId, id) as Order | undefined
  if (!o) throw new NotFoundError('Pedido no encontrado')
  // El coste estimado se recalcula con el precio ACTUAL del ingrediente: un
  // pedido abierto hace un mes no puede seguir con el precio de entonces.
  const lines = ctx.db.prepare(`SELECT l.id, l.ingredient_id, l.description, l.qty, l.unit, l.unit_cost_estimate, l.warehouse_id, l.sort_order,
                                       i.cost AS ing_cost, i.base_unit AS ing_unit
                                FROM purchase_order_lines l LEFT JOIN ingredients i ON i.org_id = l.org_id AND i.id = l.ingredient_id
                                WHERE l.org_id = ? AND l.order_id = ? ORDER BY l.sort_order, l.id`).all(ctx.orgId, id) as any[]
  const out: OrderLine[] = lines.map(l => {
    let current: number | null = null
    if (l.ing_cost != null && l.ing_unit && compatible(l.unit, l.ing_unit)) current = l.ing_cost * conversionFactor(l.unit, l.ing_unit)
    const unitCost = o.status === 'draft' || o.status === 'sent' ? (current ?? l.unit_cost_estimate) : (l.unit_cost_estimate ?? current)
    return { id: l.id, ingredient_id: l.ingredient_id, description: l.description, qty: l.qty, unit: l.unit, unit_cost_estimate: l.unit_cost_estimate,
             current_unit_cost: current, line_total: Math.round(l.qty * (unitCost ?? 0) * 100) / 100, warehouse_id: l.warehouse_id, sort_order: l.sort_order }
  })
  const total = Math.round(out.reduce((s, l) => s + l.line_total, 0) * 100) / 100
  return { ...o, total: out.length ? total : o.total, lines: out }
}

function buildOrderLine(ctx: Ctx, l: z.infer<typeof orderLineSchema>) {
  let description = l.description?.trim() || ''
  let unit = l.unit ?? null
  let cost = l.unitCostEstimate ?? null
  let warehouseId = l.warehouseId ?? null
  if (l.ingredientId) {
    const ing = getIngredient(ctx, l.ingredientId)
    description = description || ing.name
    unit = unit ?? ing.base_unit
    if (!compatible(unit, ing.base_unit)) throw new ValidationError(`"${ing.name}" se compra en ${ing.base_unit}, no en ${unit}`)
    if (cost == null && ing.cost != null) cost = ing.cost * conversionFactor(unit, ing.base_unit)
    warehouseId = warehouseId ?? ing.warehouse_id
  }
  if (!description) throw new ValidationError('La línea necesita un ingrediente o una descripción')
  if (!unit) throw new ValidationError('La línea necesita unidad')
  return { description, unit, cost, warehouseId }
}

export function createOrder(ctx: Ctx, input: unknown): Order & { lines: OrderLine[] } {
  const d = orderSchema.parse(input)
  getSupplier(ctx, d.supplierId)
  return ctx.db.transaction(() => {
    const number = d.number?.trim() || nextNumber(ctx, 'purchase_orders', 'PED')
    const r = ctx.db.prepare(`INSERT INTO purchase_orders (org_id, number, supplier_id, location_id, order_date, expected_date, notes, created_by)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(ctx.orgId, number, d.supplierId, d.locationId ?? null, d.orderDate ?? today(), d.expectedDate ?? null, d.notes ?? null, ctx.userId)
    const id = Number(r.lastInsertRowid)
    ;(d.lines ?? []).forEach((l, i) => addOrderLine(ctx, id, l, i))
    return getOrder(ctx, id)
  })()
}

export function addOrderLine(ctx: Ctx, orderId: number, input: unknown, sortOrder?: number): OrderLine[] {
  const o = getOrder(ctx, orderId)
  if (o.status !== 'draft') throw new ConflictError('Solo se pueden añadir líneas a un pedido en borrador')
  const l = orderLineSchema.parse(input)
  const b = buildOrderLine(ctx, l)
  ctx.db.prepare(`INSERT INTO purchase_order_lines (org_id, order_id, ingredient_id, description, qty, unit, unit_cost_estimate, warehouse_id, sort_order)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(ctx.orgId, orderId, l.ingredientId ?? null, b.description, l.qty, b.unit, b.cost, b.warehouseId, sortOrder ?? o.lines.length)
  return getOrder(ctx, orderId).lines
}

export function removeOrderLine(ctx: Ctx, orderId: number, lineId: number): void {
  const o = getOrder(ctx, orderId)
  if (o.status !== 'draft') throw new ConflictError('Solo se pueden quitar líneas de un pedido en borrador')
  const r = ctx.db.prepare('DELETE FROM purchase_order_lines WHERE org_id = ? AND order_id = ? AND id = ?').run(ctx.orgId, orderId, lineId)
  if (!r.changes) throw new NotFoundError('Línea no encontrada')
}

export function setOrderStatus(ctx: Ctx, id: number, to: OrderStatus, extra: { sentVia?: 'email' | 'whatsapp' | 'manual' } = {}): Order {
  const o = getOrder(ctx, id)
  assertOrderTransition(o.status, to)
  if (to === 'sent' && o.lines.length === 0) throw new ConflictError('No se puede enviar un pedido sin líneas')
  ctx.db.prepare(`UPDATE purchase_orders SET status = ?, sent_at = CASE WHEN ? = 'sent' THEN ? ELSE sent_at END, sent_via = COALESCE(?, sent_via), updated_at = ? WHERE org_id = ? AND id = ?`)
    .run(to, to, nowIso(), extra.sentVia ?? null, nowIso(), ctx.orgId, id)
  return getOrder(ctx, id)
}

/**
 * Recibir un pedido: crea el albarán en borrador con las líneas del pedido
 * ya rellenas. El usuario (o la IA con la foto) solo corrige cantidades y
 * precios reales y lo valida. El pedido pasa a received.
 */
export function receiveOrder(ctx: Ctx, orderId: number, opts: { number?: string | null; deliveryDate?: string | null } = {}): DeliveryNote & { lines: DeliveryNoteLine[] } {
  const o = getOrder(ctx, orderId)
  assertOrderTransition(o.status, 'received')
  if (o.lines.length === 0) throw new ConflictError('El pedido no tiene líneas que recibir')
  return ctx.db.transaction(() => {
    const dn = createDeliveryNote(ctx, {
      supplierId: o.supplier_id, number: opts.number ?? null, deliveryDate: opts.deliveryDate ?? today(), purchaseOrderId: o.id, source: 'order',
      lines: o.lines.map(l => ({ ingredientId: l.ingredient_id, description: l.description, qty: l.qty, unit: l.unit,
                                unitPrice: l.current_unit_cost ?? l.unit_cost_estimate ?? null, warehouseId: l.warehouse_id })),
    })
    ctx.db.prepare(`UPDATE purchase_orders SET status = 'received', updated_at = ? WHERE org_id = ? AND id = ?`).run(nowIso(), ctx.orgId, o.id)
    return dn
  })()
}

// ─── Albaranes ──────────────────────────────────────────────────────────

export const deliveryNoteLineSchema = z.object({
  ingredientId: z.number().int().positive().optional().nullable(),
  description: z.string().trim().min(1).max(200),
  qty: z.number().positive().max(1e6).optional().nullable(),
  unit: unitField.optional().nullable(),
  unitPrice: money.optional().nullable(),
  vatRate: z.number().min(0).max(100).optional().nullable(),
  lineTotal: money.optional().nullable(),
  warehouseId: z.number().int().positive().optional().nullable(),
  lot: z.string().trim().max(60).optional().nullable(),
})
export const deliveryNoteSchema = z.object({
  supplierId: z.number().int().positive().optional().nullable(),
  supplierName: z.string().trim().max(160).optional().nullable(),
  supplierTaxId: z.string().trim().max(40).optional().nullable(),
  number: z.string().trim().max(60).optional().nullable(),
  deliveryDate: dateField.optional().nullable(),
  purchaseOrderId: z.number().int().positive().optional().nullable(),
  base: money.optional().nullable(),
  vat: money.optional().nullable(),
  total: money.optional().nullable(),
  imageId: z.number().int().positive().optional().nullable(),
  source: z.enum(['manual', 'scan', 'order']).optional(),
  receivedBy: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(deliveryNoteLineSchema).optional(),
})

export interface DeliveryNote {
  id: number; supplier_id: number; supplier_name: string; number: string; delivery_date: string; purchase_order_id: number | null; invoice_id: number | null
  status: DeliveryNoteStatus; base_cents: number; vat_cents: number; total_cents: number; image_id: number | null; source: string; received_by: string | null
  notes: string | null; validated_at: string | null; line_count: number; lines_total_cents: number; created_at: string; updated_at: string
}
export interface DeliveryNoteLine {
  id: number; ingredient_id: number | null; ingredient_name: string | null; description: string; qty: number | null; unit: Unit | null; unit_price: number | null
  previous_unit_price: number | null; vat_rate: number | null; line_total_cents: number | null; warehouse_id: number | null; lot: string | null; sort_order: number
}

const DN_SELECT = `SELECT d.id, d.supplier_id, s.name AS supplier_name, d.number, d.delivery_date, d.purchase_order_id, d.invoice_id, d.status, d.base_cents, d.vat_cents, d.total_cents,
  d.image_id, d.source, d.received_by, d.notes, d.validated_at, d.created_at, d.updated_at,
  (SELECT COUNT(*) FROM delivery_note_lines l WHERE l.org_id = d.org_id AND l.delivery_note_id = d.id) AS line_count,
  (SELECT COALESCE(SUM(l.line_total_cents), 0) FROM delivery_note_lines l WHERE l.org_id = d.org_id AND l.delivery_note_id = d.id) AS lines_total_cents
  FROM delivery_notes d JOIN suppliers s ON s.org_id = d.org_id AND s.id = d.supplier_id`

export function listDeliveryNotes(ctx: Ctx, opts: { status?: DeliveryNoteStatus; supplierId?: number; unbilled?: boolean } = {}): DeliveryNote[] {
  const where = ['d.org_id = ?']; const vals: unknown[] = [ctx.orgId]
  if (opts.status) { where.push('d.status = ?'); vals.push(opts.status) }
  if (opts.supplierId) { where.push('d.supplier_id = ?'); vals.push(opts.supplierId) }
  if (opts.unbilled) where.push(`d.status = 'validated' AND d.invoice_id IS NULL`)
  return ctx.db.prepare(`${DN_SELECT} WHERE ${where.join(' AND ')} ORDER BY d.delivery_date DESC, d.id DESC`).all(...vals) as DeliveryNote[]
}

export function getDeliveryNote(ctx: Ctx, id: number): DeliveryNote & { lines: DeliveryNoteLine[] } {
  const d = ctx.db.prepare(`${DN_SELECT} WHERE d.org_id = ? AND d.id = ?`).get(ctx.orgId, id) as DeliveryNote | undefined
  if (!d) throw new NotFoundError('Albarán no encontrado')
  const lines = ctx.db.prepare(`SELECT l.id, l.ingredient_id, i.name AS ingredient_name, l.description, l.qty, l.unit, l.unit_price, l.previous_unit_price, l.vat_rate,
                                       l.line_total_cents, l.warehouse_id, l.lot, l.sort_order
                                FROM delivery_note_lines l LEFT JOIN ingredients i ON i.org_id = l.org_id AND i.id = l.ingredient_id
                                WHERE l.org_id = ? AND l.delivery_note_id = ? ORDER BY l.sort_order, l.id`).all(ctx.orgId, id) as DeliveryNoteLine[]
  return { ...d, lines }
}

function lineTotalCents(l: { qty?: number | null; unitPrice?: number | null; lineTotal?: number | null }): number | null {
  if (l.lineTotal != null) return toCents(l.lineTotal)
  if (l.qty != null && l.unitPrice != null) return toCents(l.qty * l.unitPrice)
  return null
}

export function createDeliveryNote(ctx: Ctx, input: unknown): DeliveryNote & { lines: DeliveryNoteLine[] } {
  const d = deliveryNoteSchema.parse(input)
  return ctx.db.transaction(() => {
    const supplier = d.supplierId ? getSupplier(ctx, d.supplierId)
      : d.supplierName ? ensureSupplier(ctx, { name: d.supplierName, taxId: d.supplierTaxId })
      : null
    if (!supplier) throw new ValidationError('El albarán necesita proveedor')
    const number = d.number?.trim() || nextNumber(ctx, 'delivery_notes', 'ALB')
    const dup = ctx.db.prepare('SELECT id FROM delivery_notes WHERE org_id = ? AND supplier_id = ? AND number = ?').get(ctx.orgId, supplier.id, number) as any
    if (dup) throw new ConflictError(`Ya existe el albarán ${number} de ${supplier.name}`, { deliveryNoteId: dup.id, duplicate: true })
    const base = toCents(d.base), vat = toCents(d.vat), total = d.total != null ? toCents(d.total) : base + vat
    const r = ctx.db.prepare(`INSERT INTO delivery_notes (org_id, supplier_id, number, delivery_date, purchase_order_id, base_cents, vat_cents, total_cents, image_id, source, received_by, notes)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(ctx.orgId, supplier.id, number, d.deliveryDate ?? today(), d.purchaseOrderId ?? null, base, vat, total, d.imageId ?? null, d.source ?? 'manual', d.receivedBy ?? null, d.notes ?? null)
    const id = Number(r.lastInsertRowid)
    ;(d.lines ?? []).forEach((l, i) => insertDeliveryNoteLine(ctx, id, l, i))
    return getDeliveryNote(ctx, id)
  })()
}

function insertDeliveryNoteLine(ctx: Ctx, noteId: number, l: z.infer<typeof deliveryNoteLineSchema>, sortOrder: number) {
  let previous: number | null = null
  let warehouseId = l.warehouseId ?? null
  if (l.ingredientId) {
    const ing = getIngredient(ctx, l.ingredientId)
    if (l.unit && !compatible(l.unit, ing.base_unit)) throw new ValidationError(`"${ing.name}" se compra en ${ing.base_unit}, no en ${l.unit}`)
    previous = ing.cost
    warehouseId = warehouseId ?? ing.warehouse_id
  }
  ctx.db.prepare(`INSERT INTO delivery_note_lines (org_id, delivery_note_id, ingredient_id, description, qty, unit, unit_price, previous_unit_price, vat_rate, line_total_cents, warehouse_id, lot, sort_order)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(ctx.orgId, noteId, l.ingredientId ?? null, l.description, l.qty ?? null, l.unit ?? null, l.unitPrice ?? null, previous, l.vatRate ?? null,
         lineTotalCents(l), warehouseId, l.lot ?? null, sortOrder)
}

export function addDeliveryNoteLine(ctx: Ctx, noteId: number, input: unknown): DeliveryNoteLine[] {
  const dn = getDeliveryNote(ctx, noteId)
  if (dn.status === 'validated' || dn.status === 'invoiced') throw new ConflictError('El albarán está validado y no se puede modificar')
  insertDeliveryNoteLine(ctx, noteId, deliveryNoteLineSchema.parse(input), dn.lines.length)
  return getDeliveryNote(ctx, noteId).lines
}

export function updateDeliveryNoteLine(ctx: Ctx, noteId: number, lineId: number, input: unknown): DeliveryNoteLine[] {
  const dn = getDeliveryNote(ctx, noteId)
  if (dn.status === 'validated' || dn.status === 'invoiced') throw new ConflictError('El albarán está validado y no se puede modificar')
  const l = deliveryNoteLineSchema.partial().parse(input)
  const cur = dn.lines.find(x => x.id === lineId)
  if (!cur) throw new NotFoundError('Línea no encontrada')
  if (l.ingredientId) {
    const ing = getIngredient(ctx, l.ingredientId)
    const unit = l.unit ?? cur.unit
    if (unit && !compatible(unit, ing.base_unit)) throw new ValidationError(`"${ing.name}" se compra en ${ing.base_unit}, no en ${unit}`)
  }
  const merged = { qty: l.qty ?? cur.qty, unitPrice: l.unitPrice ?? cur.unit_price, lineTotal: l.lineTotal }
  ctx.db.prepare(`UPDATE delivery_note_lines SET ingredient_id = COALESCE(?, ingredient_id), description = COALESCE(?, description), qty = COALESCE(?, qty),
                    unit = COALESCE(?, unit), unit_price = COALESCE(?, unit_price), vat_rate = COALESCE(?, vat_rate), line_total_cents = COALESCE(?, line_total_cents),
                    warehouse_id = COALESCE(?, warehouse_id), lot = COALESCE(?, lot)
                  WHERE org_id = ? AND delivery_note_id = ? AND id = ?`)
    .run(l.ingredientId ?? null, l.description ?? null, l.qty ?? null, l.unit ?? null, l.unitPrice ?? null, l.vatRate ?? null, lineTotalCents(merged),
         l.warehouseId ?? null, l.lot ?? null, ctx.orgId, noteId, lineId)
  return getDeliveryNote(ctx, noteId).lines
}

export function removeDeliveryNoteLine(ctx: Ctx, noteId: number, lineId: number): void {
  const dn = getDeliveryNote(ctx, noteId)
  if (dn.status === 'validated' || dn.status === 'invoiced') throw new ConflictError('El albarán está validado y no se puede modificar')
  const r = ctx.db.prepare('DELETE FROM delivery_note_lines WHERE org_id = ? AND delivery_note_id = ? AND id = ?').run(ctx.orgId, noteId, lineId)
  if (!r.changes) throw new NotFoundError('Línea no encontrada')
}

export interface ValidationResult {
  note: DeliveryNote & { lines: DeliveryNoteLine[] }
  pricesUpdated: number
  priceChanges: { ingredientId: number; name: string; previous: number | null; current: number; changedPct: number | null }[]
  affectedRecipes: { id: number; name: string }[]
  stockMovements: number
}

/**
 * Validar un albarán: todas las líneas mapeadas, la suma cuadra con la base,
 * se registran precios, se actualizan costes (si se pide) y entra el stock.
 * Todo o nada.
 */
export function validateDeliveryNote(ctx: Ctx, id: number, opts: { applyPrices?: boolean; force?: boolean } = {}): ValidationResult {
  return ctx.db.transaction(() => {
    const dn = getDeliveryNote(ctx, id)
    assertDeliveryNoteTransition(dn.status, 'validated')
    if (dn.lines.length === 0) throw new ConflictError('El albarán no tiene líneas: añade al menos un producto antes de validarlo')
    const unmapped = dn.lines.filter(l => !l.ingredient_id)
    if (unmapped.length) throw new ConflictError(`${unmapped.length} línea(s) sin asignar a un ingrediente`, { unmapped: unmapped.map(l => l.description) })
    const incomplete = dn.lines.filter(l => l.qty == null || l.unit == null || l.unit_price == null)
    if (incomplete.length) throw new ConflictError(`${incomplete.length} línea(s) sin cantidad, unidad o precio`, { incomplete: incomplete.map(l => l.description) })
    if (dn.base_cents > 0 && !opts.force && !amountsReconcile(dn.lines_total_cents, 0, dn.base_cents)) {
      throw new ConflictError(`La suma de las líneas (${(dn.lines_total_cents / 100).toFixed(2)} €) no cuadra con la base del albarán (${(dn.base_cents / 100).toFixed(2)} €)`,
        { linesTotal: dn.lines_total_cents, base: dn.base_cents })
    }

    const priceChanges: ValidationResult['priceChanges'] = []
    let pricesUpdated = 0, stockMovements = 0
    for (const l of dn.lines) {
      const ing = getIngredient(ctx, l.ingredient_id!)
      // Precio en la unidad base del ingrediente (línea en g, ingrediente en kg → €/kg).
      const unitPriceBase = l.unit_price! / conversionFactor(l.unit!, ing.base_unit)
      const { changedPct, previous } = recordPrice(ctx, {
        ingredientId: ing.id, supplierId: dn.supplier_id, description: l.description, qty: l.qty, unit: l.unit, unitPrice: unitPriceBase,
        lineTotal: l.line_total_cents != null ? l.line_total_cents / 100 : null, observedOn: dn.delivery_date, sourceType: 'delivery_note', sourceId: dn.id,
        applyToIngredient: opts.applyPrices !== false,
      })
      if (opts.applyPrices !== false) pricesUpdated++
      if (changedPct != null) priceChanges.push({ ingredientId: ing.id, name: ing.name, previous, current: unitPriceBase, changedPct })
      if (l.vat_rate != null && ing.vat_rate == null) ctx.db.prepare('UPDATE ingredients SET vat_rate = ? WHERE org_id = ? AND id = ?').run(l.vat_rate, ctx.orgId, ing.id)
      registerReceipt(ctx, { ingredientId: ing.id, warehouseId: l.warehouse_id ?? ing.warehouse_id, qty: l.qty! * conversionFactor(l.unit!, ing.base_unit),
                             unitCost: unitPriceBase, sourceId: dn.id, occurredAt: dn.delivery_date })
      stockMovements++
    }

    ctx.db.prepare(`UPDATE delivery_notes SET status = 'validated', validated_at = ?, validated_by = ?, updated_at = ? WHERE org_id = ? AND id = ?`)
      .run(nowIso(), ctx.userId, nowIso(), ctx.orgId, id)

    const changedIds = priceChanges.map(p => p.ingredientId)
    const affectedRecipes = changedIds.length
      ? ctx.db.prepare(`SELECT DISTINCT r.id, r.name FROM recipe_lines l JOIN recipes r ON r.org_id = l.org_id AND r.id = l.recipe_id
                        WHERE l.org_id = ? AND r.active = 1 AND l.ingredient_id IN (${changedIds.map(() => '?').join(',')}) ORDER BY r.name`).all(ctx.orgId, ...changedIds) as any[]
      : []
    return { note: getDeliveryNote(ctx, id), pricesUpdated, priceChanges, affectedRecipes, stockMovements }
  })()
}

export function setDeliveryNoteStatus(ctx: Ctx, id: number, to: 'draft' | 'review'): DeliveryNote {
  const dn = getDeliveryNote(ctx, id)
  assertDeliveryNoteTransition(dn.status, to)
  if (dn.status === 'validated') throw new ConflictError('Un albarán validado no vuelve a borrador: ya ha movido precios y stock')
  ctx.db.prepare('UPDATE delivery_notes SET status = ?, updated_at = ? WHERE org_id = ? AND id = ?').run(to, nowIso(), ctx.orgId, id)
  return getDeliveryNote(ctx, id)
}

// ─── Facturas ───────────────────────────────────────────────────────────

export const invoiceSchema = z.object({
  supplierId: z.number().int().positive().optional().nullable(),
  supplierName: z.string().trim().max(160).optional().nullable(),
  supplierTaxId: z.string().trim().max(40).optional().nullable(),
  number: z.string().trim().min(1, 'Falta el número de factura').max(60),
  invoiceDate: dateField,
  dueDate: dateField.optional().nullable(),
  accountingDate: dateField.optional().nullable(),
  base: money.optional().nullable(),
  vat: money.optional().nullable(),
  total: money.optional().nullable(),
  deliveryNoteIds: z.array(z.number().int().positive()).optional(),
  imageId: z.number().int().positive().optional().nullable(),
  source: z.enum(['manual', 'scan']).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export interface Invoice {
  id: number; supplier_id: number; supplier_name: string; number: string; invoice_date: string; due_date: string | null; accounting_date: string | null
  base_cents: number; vat_cents: number; total_cents: number; status: 'pending' | 'paid'; paid_on: string | null; image_id: number | null; source: string
  notes: string | null; delivery_note_count: number; delivery_notes_base_cents: number; created_at: string; updated_at: string
}

const INV_SELECT = `SELECT v.id, v.supplier_id, s.name AS supplier_name, v.number, v.invoice_date, v.due_date, v.accounting_date, v.base_cents, v.vat_cents, v.total_cents,
  v.status, v.paid_on, v.image_id, v.source, v.notes, v.created_at, v.updated_at,
  (SELECT COUNT(*) FROM delivery_notes d WHERE d.org_id = v.org_id AND d.invoice_id = v.id) AS delivery_note_count,
  (SELECT COALESCE(SUM(d.base_cents), 0) FROM delivery_notes d WHERE d.org_id = v.org_id AND d.invoice_id = v.id) AS delivery_notes_base_cents
  FROM invoices v JOIN suppliers s ON s.org_id = v.org_id AND s.id = v.supplier_id`

export function listInvoices(ctx: Ctx, opts: { status?: 'pending' | 'paid'; supplierId?: number; dueBefore?: string } = {}): Invoice[] {
  const where = ['v.org_id = ?']; const vals: unknown[] = [ctx.orgId]
  if (opts.status) { where.push('v.status = ?'); vals.push(opts.status) }
  if (opts.supplierId) { where.push('v.supplier_id = ?'); vals.push(opts.supplierId) }
  if (opts.dueBefore) { where.push('v.due_date < ?'); vals.push(opts.dueBefore) }
  return ctx.db.prepare(`${INV_SELECT} WHERE ${where.join(' AND ')} ORDER BY v.invoice_date DESC, v.id DESC`).all(...vals) as Invoice[]
}

export function getInvoice(ctx: Ctx, id: number): Invoice & { deliveryNotes: DeliveryNote[] } {
  const v = ctx.db.prepare(`${INV_SELECT} WHERE v.org_id = ? AND v.id = ?`).get(ctx.orgId, id) as Invoice | undefined
  if (!v) throw new NotFoundError('Factura no encontrada')
  const deliveryNotes = ctx.db.prepare(`${DN_SELECT} WHERE d.org_id = ? AND d.invoice_id = ? ORDER BY d.delivery_date`).all(ctx.orgId, id) as DeliveryNote[]
  return { ...v, deliveryNotes }
}

/** Albaranes validados y sin facturar del proveedor, los candidatos a entrar en una factura. */
export function unbilledDeliveryNotes(ctx: Ctx, supplierId: number): DeliveryNote[] {
  return listDeliveryNotes(ctx, { supplierId, unbilled: true })
}

export function createInvoice(ctx: Ctx, input: unknown): Invoice & { deliveryNotes: DeliveryNote[] } {
  const d = invoiceSchema.parse(input)
  return ctx.db.transaction(() => {
    const supplier = d.supplierId ? getSupplier(ctx, d.supplierId)
      : d.supplierName ? ensureSupplier(ctx, { name: d.supplierName, taxId: d.supplierTaxId })
      : null
    if (!supplier) throw new ValidationError('La factura necesita proveedor')
    const dup = ctx.db.prepare('SELECT id FROM invoices WHERE org_id = ? AND supplier_id = ? AND number = ?').get(ctx.orgId, supplier.id, d.number) as any
    if (dup) throw new ConflictError(`Ya existe la factura ${d.number} de ${supplier.name}`, { invoiceId: dup.id, duplicate: true })
    if (d.dueDate && d.dueDate < d.invoiceDate) throw new ValidationError('El vencimiento no puede ser anterior a la fecha de factura')
    const base = toCents(d.base), vat = toCents(d.vat), total = d.total != null ? toCents(d.total) : base + vat
    if (!amountsReconcile(base, vat, total)) throw new ValidationError(`Base (${(base / 100).toFixed(2)}) + IVA (${(vat / 100).toFixed(2)}) no cuadra con el total (${(total / 100).toFixed(2)})`)
    const r = ctx.db.prepare(`INSERT INTO invoices (org_id, supplier_id, number, invoice_date, due_date, accounting_date, base_cents, vat_cents, total_cents, image_id, source, notes, lines_resolved)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(ctx.orgId, supplier.id, d.number, d.invoiceDate, d.dueDate ?? null, d.accountingDate ?? null, base, vat, total, d.imageId ?? null, d.source ?? 'manual', d.notes ?? null)
    const id = Number(r.lastInsertRowid)
    if (d.deliveryNoteIds?.length) attachDeliveryNotes(ctx, id, d.deliveryNoteIds)
    return getInvoice(ctx, id)
  })()
}

/**
 * Vincula albaranes validados a la factura. Un albarán solo puede estar en
 * una factura, del mismo proveedor, y no anterior a él. Se comprueba que la
 * base de la factura cuadre con la suma de sus albaranes.
 */
export function attachDeliveryNotes(ctx: Ctx, invoiceId: number, noteIds: number[]): Invoice & { deliveryNotes: DeliveryNote[] } {
  return ctx.db.transaction(() => {
    const inv = getInvoice(ctx, invoiceId)
    for (const nid of noteIds) {
      const dn = getDeliveryNote(ctx, nid)
      if (dn.supplier_id !== inv.supplier_id) throw new ConflictError(`El albarán ${dn.number} es de otro proveedor`)
      if (dn.invoice_id && dn.invoice_id !== invoiceId) throw new ConflictError(`El albarán ${dn.number} ya está en otra factura`, { invoiceId: dn.invoice_id })
      if (dn.status !== 'validated' && dn.status !== 'invoiced') throw new ConflictError(`El albarán ${dn.number} no está validado`)
      if (dn.delivery_date > inv.invoice_date) throw new ValidationError(`La factura (${inv.invoice_date}) es anterior al albarán ${dn.number} (${dn.delivery_date})`)
      ctx.db.prepare(`UPDATE delivery_notes SET invoice_id = ?, status = 'invoiced', updated_at = ? WHERE org_id = ? AND id = ?`).run(invoiceId, nowIso(), ctx.orgId, nid)
    }
    const after = getInvoice(ctx, invoiceId)
    if (after.base_cents > 0 && after.delivery_note_count > 0 && !amountsReconcile(after.delivery_notes_base_cents, 0, after.base_cents)) {
      throw new ConflictError(`La suma de los albaranes (${(after.delivery_notes_base_cents / 100).toFixed(2)} €) no cuadra con la base de la factura (${(after.base_cents / 100).toFixed(2)} €)`,
        { deliveryNotesBase: after.delivery_notes_base_cents, base: after.base_cents })
    }
    return after
  })()
}

export function detachDeliveryNote(ctx: Ctx, invoiceId: number, noteId: number): void {
  const dn = getDeliveryNote(ctx, noteId)
  if (dn.invoice_id !== invoiceId) throw new NotFoundError('Ese albarán no está en esta factura')
  ctx.db.prepare(`UPDATE delivery_notes SET invoice_id = NULL, status = 'validated', updated_at = ? WHERE org_id = ? AND id = ?`).run(nowIso(), ctx.orgId, noteId)
}

export function setInvoicePaid(ctx: Ctx, id: number, paid: boolean, paidOn?: string | null): Invoice {
  const v = getInvoice(ctx, id)
  assertInvoiceTransition(v.status, paid ? 'paid' : 'pending')
  const on = paid ? (paidOn && isIsoDate(paidOn) ? paidOn : today()) : null
  ctx.db.prepare(`UPDATE invoices SET status = ?, paid_on = ?, updated_at = ? WHERE org_id = ? AND id = ?`).run(paid ? 'paid' : 'pending', on, nowIso(), ctx.orgId, id)
  return getInvoice(ctx, id)
}
