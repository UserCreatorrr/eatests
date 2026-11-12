// Stock por movimientos (Sprint 3). El libro mayor solo crece; el stock
// actual es la suma. Entradas desde albaranes, salidas por merma y
// producción, ajustes por recuento.
import { z } from 'zod'
import { nowIso, parseDate, today } from '@/server/domain/dates'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import { conversionFactor, compatible, parseUnit, type Unit } from '@/server/domain/units'
import type { Ctx } from '@/server/http/context'
import { getIngredient } from './catalog'

export type MovementKind = 'receipt' | 'waste' | 'production' | 'transfer' | 'adjustment' | 'count'

function insert(ctx: Ctx, m: { ingredientId: number; warehouseId: number | null; qty: number; unitCost: number | null; kind: MovementKind; sourceType?: string | null; sourceId?: number | null; occurredAt: string; note?: string | null }) {
  if (!m.qty || !Number.isFinite(m.qty)) throw new ValidationError('Movimiento de stock sin cantidad')
  ctx.db.prepare(`INSERT INTO stock_movements (org_id, ingredient_id, warehouse_id, qty, unit_cost, kind, source_type, source_id, occurred_at, note, created_by)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(ctx.orgId, m.ingredientId, m.warehouseId, m.qty, m.unitCost, m.kind, m.sourceType ?? null, m.sourceId ?? null, m.occurredAt, m.note ?? null, ctx.userId)
}

/** Entrada por albarán validado. `qty` ya en la unidad base del ingrediente. */
export function registerReceipt(ctx: Ctx, m: { ingredientId: number; warehouseId: number | null; qty: number; unitCost: number | null; sourceId: number; occurredAt: string }) {
  insert(ctx, { ...m, kind: 'receipt', sourceType: 'delivery_note', occurredAt: m.occurredAt })
}

/** Salida por merma o producción. Convierte la unidad a la base del ingrediente. */
export function registerOutflow(ctx: Ctx, m: { ingredientId: number; warehouseId?: number | null; qty: number; unit: Unit; kind: 'waste' | 'production'; sourceType: string; sourceId: number; occurredAt: string }) {
  const ing = getIngredient(ctx, m.ingredientId)
  if (!compatible(m.unit, ing.base_unit)) throw new ValidationError(`"${ing.name}" se controla en ${ing.base_unit}, no en ${m.unit}`)
  const qtyBase = m.qty * conversionFactor(m.unit, ing.base_unit)
  insert(ctx, { ingredientId: ing.id, warehouseId: m.warehouseId ?? ing.warehouse_id, qty: -qtyBase, unitCost: ing.cost, kind: m.kind, sourceType: m.sourceType, sourceId: m.sourceId, occurredAt: m.occurredAt })
}

export const adjustmentSchema = z.object({
  ingredientId: z.number().int().positive(),
  warehouseId: z.number().int().positive().optional().nullable(),
  qty: z.number().refine(v => v !== 0, 'La cantidad no puede ser 0'),
  unit: z.string().transform((v, c) => { const u = parseUnit(v); if (!u) { c.addIssue({ code: 'custom', message: `Unidad no válida: ${v}` }); return z.NEVER } return u }),
  note: z.string().trim().max(500).optional().nullable(),
  occurredOn: z.string().optional().nullable(),
})

export function registerAdjustment(ctx: Ctx, input: unknown) {
  const d = adjustmentSchema.parse(input)
  const ing = getIngredient(ctx, d.ingredientId)
  if (!compatible(d.unit, ing.base_unit)) throw new ValidationError(`"${ing.name}" se controla en ${ing.base_unit}, no en ${d.unit}`)
  const on = d.occurredOn ? parseDate(d.occurredOn) : today()
  if (!on) throw new ValidationError('Fecha no válida')
  insert(ctx, { ingredientId: ing.id, warehouseId: d.warehouseId ?? ing.warehouse_id, qty: d.qty * conversionFactor(d.unit, ing.base_unit), unitCost: ing.cost, kind: 'adjustment', occurredAt: on, note: d.note })
}

export interface StockLevel { ingredient_id: number; name: string; base_unit: Unit; warehouse_id: number | null; warehouse_name: string | null; qty: number; value: number; last_movement: string }

export function stockLevels(ctx: Ctx, opts: { warehouseId?: number; ingredientId?: number } = {}): StockLevel[] {
  const where = ['m.org_id = ?']; const vals: unknown[] = [ctx.orgId]
  if (opts.warehouseId) { where.push('m.warehouse_id = ?'); vals.push(opts.warehouseId) }
  if (opts.ingredientId) { where.push('m.ingredient_id = ?'); vals.push(opts.ingredientId) }
  // Valor = existencias × coste actual del ingrediente. Nunca sumar precios unitarios.
  return ctx.db.prepare(`SELECT m.ingredient_id, i.name, i.base_unit, m.warehouse_id, w.name AS warehouse_name,
                                ROUND(SUM(m.qty), 4) AS qty, ROUND(SUM(m.qty) * COALESCE(i.cost, 0), 2) AS value, MAX(m.occurred_at) AS last_movement
                         FROM stock_movements m JOIN ingredients i ON i.org_id = m.org_id AND i.id = m.ingredient_id
                         LEFT JOIN warehouses w ON w.org_id = m.org_id AND w.id = m.warehouse_id
                         WHERE ${where.join(' AND ')} GROUP BY m.ingredient_id, m.warehouse_id HAVING ABS(SUM(m.qty)) > 0.00001 ORDER BY i.name, w.name`)
    .all(...vals) as StockLevel[]
}

export function movements(ctx: Ctx, ingredientId: number, limit = 100) {
  getIngredient(ctx, ingredientId)
  return ctx.db.prepare(`SELECT m.id, m.warehouse_id, w.name AS warehouse_name, m.qty, m.unit_cost, m.kind, m.source_type, m.source_id, m.occurred_at, m.note, m.created_at
                         FROM stock_movements m LEFT JOIN warehouses w ON w.org_id = m.org_id AND w.id = m.warehouse_id
                         WHERE m.org_id = ? AND m.ingredient_id = ? ORDER BY m.occurred_at DESC, m.id DESC LIMIT ?`).all(ctx.orgId, ingredientId, limit)
}

// ─── Recuento físico ──────────────────────────────────────────────────────

export const countSchema = z.object({
  warehouseId: z.number().int().positive().optional().nullable(),
  countedOn: z.string().optional().nullable(),
  lines: z.array(z.object({ ingredientId: z.number().int().positive(), qty: z.number().min(0), unit: z.string() })).min(1),
})

export interface CountResult { ingredientId: number; name: string; theoretical: number; counted: number; deviation: number; deviationValue: number; unit: Unit }

/**
 * Recuento: para cada ingrediente contado, la diferencia con el teórico se
 * registra como movimiento `count`. Lo que no se cuenta no se toca (nunca se
 * da por cero un producto que simplemente no se contó).
 */
export function registerCount(ctx: Ctx, input: unknown): CountResult[] {
  const d = countSchema.parse(input)
  const on = d.countedOn ? parseDate(d.countedOn) : today()
  if (!on) throw new ValidationError('Fecha no válida')
  return ctx.db.transaction(() => {
    const out: CountResult[] = []
    for (const l of d.lines) {
      const ing = getIngredient(ctx, l.ingredientId)
      const unit = parseUnit(l.unit)
      if (!unit || !compatible(unit, ing.base_unit)) throw new ValidationError(`"${ing.name}" se controla en ${ing.base_unit}, no en ${l.unit}`)
      const counted = l.qty * conversionFactor(unit, ing.base_unit)
      const wh = d.warehouseId ?? ing.warehouse_id
      const theoretical = (ctx.db.prepare(`SELECT COALESCE(SUM(qty), 0) AS q FROM stock_movements WHERE org_id = ? AND ingredient_id = ? AND (warehouse_id IS ? OR (warehouse_id IS NULL AND ? IS NULL)) AND occurred_at <= ?`)
        .get(ctx.orgId, ing.id, wh, wh, on + 'T23:59:59') as any).q as number
      const deviation = counted - theoretical
      if (Math.abs(deviation) > 0.00001) {
        insert(ctx, { ingredientId: ing.id, warehouseId: wh, qty: deviation, unitCost: ing.cost, kind: 'count', sourceType: 'count', occurredAt: on, note: `Recuento: teórico ${theoretical.toFixed(3)}, contado ${counted.toFixed(3)}` })
      }
      out.push({ ingredientId: ing.id, name: ing.name, theoretical: Math.round(theoretical * 10000) / 10000, counted, deviation: Math.round(deviation * 10000) / 10000,
                 deviationValue: Math.round(deviation * (ing.cost ?? 0) * 100) / 100, unit: ing.base_unit })
    }
    return out
  })()
}

export function warehouseById(ctx: Ctx, id: number) {
  const w = ctx.db.prepare('SELECT id, name, kind, location_id, active FROM warehouses WHERE org_id = ? AND id = ?').get(ctx.orgId, id)
  if (!w) throw new NotFoundError('Almacén no encontrado')
  return w
}

export function ensureWarehouse(ctx: Ctx, name: string, kind: 'refrigerated' | 'frozen' | 'dry' | 'other' = 'other'): number {
  const existing = ctx.db.prepare('SELECT id FROM warehouses WHERE org_id = ? AND name = ? COLLATE NOCASE').get(ctx.orgId, name.trim()) as any
  if (existing) return existing.id
  const r = ctx.db.prepare('INSERT INTO warehouses (org_id, name, kind) VALUES (?, ?, ?)').run(ctx.orgId, name.trim(), kind)
  return Number(r.lastInsertRowid)
}

export const _internal = { insert, nowIso }

// ─── Almacenes ──────────────────────────────────────────────────────────

export const warehouseSchema = z.object({
  name: z.string().trim().min(1, 'Falta el nombre').max(80),
  kind: z.enum(['refrigerated', 'frozen', 'dry', 'other']).optional(),
  locationId: z.number().int().positive().optional().nullable(),
})

export interface Warehouse { id: number; name: string; kind: string; location_id: number | null; active: number; ingredients: number }

export function listWarehouses(ctx: Ctx): Warehouse[] {
  return ctx.db.prepare(`SELECT w.id, w.name, w.kind, w.location_id, w.active, (SELECT COUNT(*) FROM ingredients i WHERE i.org_id = w.org_id AND i.warehouse_id = w.id AND i.active = 1) AS ingredients
                         FROM warehouses w WHERE w.org_id = ? AND w.active = 1 ORDER BY w.name`).all(ctx.orgId) as Warehouse[]
}

export function createWarehouse(ctx: Ctx, input: unknown): Warehouse {
  const d = warehouseSchema.parse(input)
  const id = ensureWarehouse(ctx, d.name, d.kind ?? 'other')
  if (d.locationId != null) ctx.db.prepare('UPDATE warehouses SET location_id = ? WHERE org_id = ? AND id = ?').run(d.locationId, ctx.orgId, id)
  return listWarehouses(ctx).find(w => w.id === id)!
}

export function deactivateWarehouse(ctx: Ctx, id: number): void {
  const w = warehouseById(ctx, id)
  if (!w) throw new NotFoundError('Almacén no encontrado')
  ctx.db.prepare('UPDATE ingredients SET warehouse_id = NULL WHERE org_id = ? AND warehouse_id = ?').run(ctx.orgId, id)
  ctx.db.prepare('UPDATE warehouses SET active = 0 WHERE org_id = ? AND id = ?').run(ctx.orgId, id)
}
