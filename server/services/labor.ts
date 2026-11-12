// Labor: empleados, turnos, ventas por franja, objetivos e importación CSV.
// Los cálculos viven en server/domain/labor; aquí solo se cargan y guardan datos.
import { z } from 'zod'
import { addDays, isHm, parseDate, parseHm, today } from '@/server/domain/dates'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import { idealShift, isOvernight, netHours, overlapHours, parseEuNumber, parseSlotLabel, summarizeLabor, summarizeProductivity, type IdealShiftInput, type LaborTarget, type SalesSlot, type Shift } from '@/server/domain/labor'
import { fromCents } from '@/server/domain/money'
import type { Ctx } from '@/server/http/context'

const hmField = z.string().transform((v, c) => { const h = parseHm(v); if (!h) { c.addIssue({ code: 'custom', message: `Hora no válida: ${v}` }); return z.NEVER } return h })
const dateField = z.string().transform((v, c) => { const d = parseDate(v); if (!d) { c.addIssue({ code: 'custom', message: `Fecha no válida: ${v}` }); return z.NEVER } return d })

// ─── Centros ─────────────────────────────────────────────────────────────

export function listLocations(ctx: Ctx) {
  return ctx.db.prepare('SELECT id, code, name, city, active FROM locations WHERE org_id = ? AND active = 1 ORDER BY name').all(ctx.orgId) as { id: number; code: string; name: string; city: string | null; active: number }[]
}

export const locationSchema = z.object({ code: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(120), city: z.string().trim().max(80).optional().nullable() })

export function createLocation(ctx: Ctx, input: unknown) {
  const d = locationSchema.parse(input)
  const r = ctx.db.prepare('INSERT INTO locations (org_id, code, name, city) VALUES (?, ?, ?, ?)').run(ctx.orgId, d.code, d.name, d.city ?? null)
  return ctx.db.prepare('SELECT id, code, name, city, active FROM locations WHERE id = ?').get(r.lastInsertRowid)
}

function assertLocation(ctx: Ctx, id: number | null | undefined) {
  if (id == null) return null
  const row = ctx.db.prepare('SELECT id FROM locations WHERE org_id = ? AND id = ?').get(ctx.orgId, id)
  if (!row) throw new ValidationError('El centro indicado no existe')
  return id
}

// ─── Empleados ───────────────────────────────────────────────────────────

export const employeeSchema = z.object({
  name: z.string().trim().min(1, 'Falta el nombre').max(120),
  code: z.string().trim().max(40).optional().nullable(),
  locationId: z.number().int().positive().optional().nullable(),
  role: z.string().trim().max(60).optional().nullable(),
  contractType: z.string().trim().max(60).optional().nullable(),
  hourlyCost: z.number().min(0).max(500).optional().nullable(),
  employerCost: z.number().min(0).max(500).optional().nullable(),
  contractHoursWeek: z.number().min(0).max(80).optional().nullable(),
  active: z.boolean().optional(),
})

export interface Employee { id: number; code: string | null; name: string; location_id: number | null; role: string | null; contract_type: string | null; hourly_cost: number | null; employer_cost: number | null; contract_hours_week: number | null; active: number }

const EMP = 'SELECT id, code, name, location_id, role, contract_type, hourly_cost, employer_cost, contract_hours_week, active FROM employees'

export function listEmployees(ctx: Ctx, opts: { includeInactive?: boolean } = {}): Employee[] {
  return ctx.db.prepare(`${EMP} WHERE org_id = ? ${opts.includeInactive ? '' : 'AND active = 1'} ORDER BY name`).all(ctx.orgId) as Employee[]
}
export function getEmployee(ctx: Ctx, id: number): Employee {
  const e = ctx.db.prepare(`${EMP} WHERE org_id = ? AND id = ?`).get(ctx.orgId, id) as Employee | undefined
  if (!e) throw new NotFoundError('Empleado no encontrado')
  return e
}
export function createEmployee(ctx: Ctx, input: unknown): Employee {
  const d = employeeSchema.parse(input)
  assertLocation(ctx, d.locationId)
  const r = ctx.db.prepare('INSERT INTO employees (org_id, code, name, location_id, role, contract_type, hourly_cost, employer_cost, contract_hours_week, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(ctx.orgId, d.code || null, d.name, d.locationId ?? null, d.role ?? null, d.contractType ?? null, d.hourlyCost ?? null, d.employerCost ?? null, d.contractHoursWeek ?? null, d.active === false ? 0 : 1)
  return getEmployee(ctx, Number(r.lastInsertRowid))
}
export function updateEmployee(ctx: Ctx, id: number, input: unknown): Employee {
  const cur = getEmployee(ctx, id)
  const d = employeeSchema.partial().parse(input)
  assertLocation(ctx, d.locationId)
  ctx.db.prepare('UPDATE employees SET code = ?, name = ?, location_id = ?, role = ?, contract_type = ?, hourly_cost = ?, employer_cost = ?, contract_hours_week = ?, active = ? WHERE org_id = ? AND id = ?')
    .run(d.code !== undefined ? d.code || null : cur.code, d.name ?? cur.name, d.locationId !== undefined ? d.locationId : cur.location_id, d.role !== undefined ? d.role : cur.role,
         d.contractType !== undefined ? d.contractType : cur.contract_type, d.hourlyCost !== undefined ? d.hourlyCost : cur.hourly_cost, d.employerCost !== undefined ? d.employerCost : cur.employer_cost,
         d.contractHoursWeek !== undefined ? d.contractHoursWeek : cur.contract_hours_week, d.active !== undefined ? (d.active ? 1 : 0) : cur.active, ctx.orgId, id)
  return getEmployee(ctx, id)
}
export function deactivateEmployee(ctx: Ctx, id: number): void {
  getEmployee(ctx, id)
  // Los turnos pasados siguen apuntando a la persona: se desactiva, no se borra.
  ctx.db.prepare('UPDATE employees SET active = 0 WHERE org_id = ? AND id = ?').run(ctx.orgId, id)
}

// ─── Turnos ──────────────────────────────────────────────────────────────

export const shiftSchema = z.object({
  shiftDate: dateField,
  startTime: hmField,
  endTime: hmField,
  breakMinutes: z.number().int().min(0).max(600).optional(),
  employeeId: z.number().int().positive().optional().nullable(),
  employeeName: z.string().trim().max(120).optional().nullable(),
  role: z.string().trim().max(60).optional().nullable(),
  service: z.string().trim().max(60).optional().nullable(),
  locationId: z.number().int().positive().optional().nullable(),
  hourlyCost: z.number().min(0).max(500).optional().nullable(),
  actualHours: z.number().min(0).max(24).optional().nullable(),
  source: z.string().trim().max(40).optional().nullable(),
})
export type ShiftInput = z.infer<typeof shiftSchema>

export interface ShiftRow extends Shift { id: number; employee_id: number | null; employee_name: string; overnight: number; source: string | null }

const SHIFT = 'SELECT id, location_id, employee_id, employee_name, role, service, shift_date, start_time, end_time, break_minutes, planned_hours, actual_hours, hourly_cost, overnight, source FROM shifts'

export interface Range { from?: string | null; to?: string | null; locationId?: number | null }
function rangeWhere(r: Range, dateCol: string): { sql: string; params: (string | number)[] } {
  const from = r.from ? parseDate(r.from) : null, to = r.to ? parseDate(r.to) : null
  if ((r.from && !from) || (r.to && !to)) throw new ValidationError('Rango de fechas no válido')
  const parts: string[] = [], params: (string | number)[] = []
  if (from) { parts.push(`${dateCol} >= ?`); params.push(from) }
  if (to) { parts.push(`${dateCol} <= ?`); params.push(to) }
  if (r.locationId != null) { parts.push('location_id = ?'); params.push(r.locationId) }
  return { sql: parts.length ? ' AND ' + parts.join(' AND ') : '', params }
}

export function listShifts(ctx: Ctx, r: Range = {}): ShiftRow[] {
  const w = rangeWhere(r, 'shift_date')
  return ctx.db.prepare(`${SHIFT} WHERE org_id = ?${w.sql} ORDER BY shift_date, start_time, employee_name`).all(ctx.orgId, ...w.params) as ShiftRow[]
}

/** Prepara una fila de turno: resuelve el empleado, hereda su coste y calcula las horas plan. */
function buildShift(ctx: Ctx, d: ShiftInput, employees: Employee[]) {
  const emp = d.employeeId != null ? employees.find(e => e.id === d.employeeId) ?? null
    : d.employeeName ? employees.find(e => e.name.toLowerCase() === d.employeeName!.toLowerCase()) ?? null : null
  if (d.employeeId != null && !emp) throw new ValidationError('El empleado indicado no existe')
  assertLocation(ctx, d.locationId)
  const breakMinutes = d.breakMinutes ?? 0
  const planned = netHours({ start_time: d.startTime, end_time: d.endTime, break_minutes: breakMinutes })
  if (planned <= 0) throw new ValidationError('El turno no tiene horas: revisa inicio, fin y descanso')
  return {
    location_id: d.locationId ?? emp?.location_id ?? null, employee_id: emp?.id ?? null,
    employee_name: emp?.name ?? (d.employeeName?.trim() || 'Sin nombre'), role: d.role ?? emp?.role ?? null, service: d.service ?? null,
    shift_date: d.shiftDate, start_time: d.startTime, end_time: d.endTime, break_minutes: breakMinutes, planned_hours: Math.round(planned * 100) / 100,
    actual_hours: d.actualHours ?? null, hourly_cost: d.hourlyCost ?? emp?.hourly_cost ?? null, overnight: isOvernight(d.startTime, d.endTime) ? 1 : 0, source: d.source ?? 'manual',
    linked: !!emp,
  }
}

const INSERT_SHIFT = `INSERT OR IGNORE INTO shifts (org_id, location_id, employee_id, employee_name, role, service, shift_date, start_time, end_time, break_minutes, planned_hours, actual_hours, hourly_cost, overnight, source)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

export function createShift(ctx: Ctx, input: unknown): ShiftRow {
  const d = shiftSchema.parse(input)
  const s = buildShift(ctx, d, listEmployees(ctx, { includeInactive: true }))
  const r = ctx.db.prepare(INSERT_SHIFT).run(ctx.orgId, s.location_id, s.employee_id, s.employee_name, s.role, s.service, s.shift_date, s.start_time, s.end_time, s.break_minutes, s.planned_hours, s.actual_hours, s.hourly_cost, s.overnight, s.source)
  if (!r.changes) throw new ValidationError('Ese turno ya existe (misma persona, fecha y horas)')
  return ctx.db.prepare(`${SHIFT} WHERE id = ?`).get(r.lastInsertRowid) as ShiftRow
}

export function updateShift(ctx: Ctx, id: number, input: unknown): ShiftRow {
  const cur = ctx.db.prepare(`${SHIFT} WHERE org_id = ? AND id = ?`).get(ctx.orgId, id) as ShiftRow | undefined
  if (!cur) throw new NotFoundError('Turno no encontrado')
  const p = shiftSchema.partial().parse(input)
  const merged = shiftSchema.parse({
    shiftDate: p.shiftDate ?? cur.shift_date, startTime: p.startTime ?? cur.start_time, endTime: p.endTime ?? cur.end_time, breakMinutes: p.breakMinutes ?? cur.break_minutes,
    employeeId: p.employeeId !== undefined ? p.employeeId : cur.employee_id, employeeName: p.employeeName !== undefined ? p.employeeName : cur.employee_name,
    role: p.role !== undefined ? p.role : cur.role, service: p.service !== undefined ? p.service : cur.service, locationId: p.locationId !== undefined ? p.locationId : cur.location_id,
    hourlyCost: p.hourlyCost !== undefined ? p.hourlyCost : cur.hourly_cost, actualHours: p.actualHours !== undefined ? p.actualHours : cur.actual_hours, source: cur.source,
  })
  const s = buildShift(ctx, merged, listEmployees(ctx, { includeInactive: true }))
  ctx.db.prepare(`UPDATE shifts SET location_id = ?, employee_id = ?, employee_name = ?, role = ?, service = ?, shift_date = ?, start_time = ?, end_time = ?, break_minutes = ?, planned_hours = ?, actual_hours = ?, hourly_cost = ?, overnight = ? WHERE org_id = ? AND id = ?`)
    .run(s.location_id, s.employee_id, s.employee_name, s.role, s.service, s.shift_date, s.start_time, s.end_time, s.break_minutes, s.planned_hours, s.actual_hours, s.hourly_cost, s.overnight, ctx.orgId, id)
  return ctx.db.prepare(`${SHIFT} WHERE id = ?`).get(id) as ShiftRow
}

export function removeShift(ctx: Ctx, id: number): void {
  const r = ctx.db.prepare('DELETE FROM shifts WHERE org_id = ? AND id = ?').run(ctx.orgId, id)
  if (!r.changes) throw new NotFoundError('Turno no encontrado')
}

// ─── Ventas por franja ───────────────────────────────────────────────────

export const salesSlotSchema = z.object({
  saleDate: dateField,
  slotStart: hmField,
  slotEnd: hmField.optional().nullable(),
  channel: z.string().trim().max(40).optional().nullable(),
  netSales: z.number().min(0).max(1e7),
  covers: z.number().int().min(0).optional().nullable(),
  orders: z.number().int().min(0).optional().nullable(),
  tickets: z.number().int().min(0).optional().nullable(),
  locationId: z.number().int().positive().optional().nullable(),
  source: z.string().trim().max(40).optional().nullable(),
})

export interface SalesSlotRow extends SalesSlot { id: number; source: string | null }
const SLOT = 'SELECT id, location_id, sale_date, slot_start, slot_end, channel, net_sales, covers, orders, tickets, source FROM sales_slots'

export function listSalesSlots(ctx: Ctx, r: Range = {}): SalesSlotRow[] {
  const w = rangeWhere(r, 'sale_date')
  return ctx.db.prepare(`${SLOT} WHERE org_id = ?${w.sql} ORDER BY sale_date, slot_start`).all(ctx.orgId, ...w.params) as SalesSlotRow[]
}

const INSERT_SLOT = `INSERT OR IGNORE INTO sales_slots (org_id, location_id, sale_date, slot_start, slot_end, channel, net_sales, covers, orders, tickets, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

export function createSalesSlot(ctx: Ctx, input: unknown): SalesSlotRow {
  const d = salesSlotSchema.parse(input)
  assertLocation(ctx, d.locationId)
  const r = ctx.db.prepare(INSERT_SLOT).run(ctx.orgId, d.locationId ?? null, d.saleDate, d.slotStart, d.slotEnd ?? null, d.channel || 'sala', d.netSales, d.covers ?? null, d.orders ?? null, d.tickets ?? null, d.source ?? 'manual')
  if (!r.changes) throw new ValidationError('Ya hay ventas registradas para esa franja y canal')
  return ctx.db.prepare(`${SLOT} WHERE id = ?`).get(r.lastInsertRowid) as SalesSlotRow
}

export function removeSalesSlot(ctx: Ctx, id: number): void {
  const r = ctx.db.prepare('DELETE FROM sales_slots WHERE org_id = ? AND id = ?').run(ctx.orgId, id)
  if (!r.changes) throw new NotFoundError('Franja no encontrada')
}

// ─── Objetivos ───────────────────────────────────────────────────────────

export const targetSchema = z.object({
  locationId: z.number().int().positive().optional().nullable(),
  service: z.string().trim().max(60).optional().nullable(),
  role: z.string().trim().max(60).optional().nullable(),
  targetLaborPct: z.number().gt(0).max(100).optional().nullable(),
  targetSplh: z.number().min(0).optional().nullable(),
  targetSalesPerEmployee: z.number().min(0).optional().nullable(),
  targetProductivityIndex: z.number().optional().nullable(),
  minStaff: z.number().int().min(0).optional().nullable(),
  maxStaff: z.number().int().min(0).optional().nullable(),
})

export interface TargetRow extends LaborTarget { id: number; location_id: number | null; target_sales_per_employee: number | null; target_productivity_index: number | null }
const TARGET = 'SELECT id, location_id, service, role, target_labor_pct, target_splh, target_sales_per_employee, target_productivity_index, min_staff, max_staff FROM labor_targets'

export function listTargets(ctx: Ctx, locationId?: number | null): TargetRow[] {
  return locationId != null
    ? ctx.db.prepare(`${TARGET} WHERE org_id = ? AND (location_id = ? OR location_id IS NULL) ORDER BY id`).all(ctx.orgId, locationId) as TargetRow[]
    : ctx.db.prepare(`${TARGET} WHERE org_id = ? ORDER BY id`).all(ctx.orgId) as TargetRow[]
}
export function createTarget(ctx: Ctx, input: unknown): TargetRow {
  const d = targetSchema.parse(input)
  assertLocation(ctx, d.locationId)
  if (d.minStaff != null && d.maxStaff != null && d.minStaff > d.maxStaff) throw new ValidationError('El mínimo de personal no puede superar al máximo')
  const r = ctx.db.prepare('INSERT INTO labor_targets (org_id, location_id, service, role, target_labor_pct, target_splh, target_sales_per_employee, target_productivity_index, min_staff, max_staff) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(ctx.orgId, d.locationId ?? null, d.service || null, d.role || null, d.targetLaborPct ?? null, d.targetSplh ?? null, d.targetSalesPerEmployee ?? null, d.targetProductivityIndex ?? null, d.minStaff ?? null, d.maxStaff ?? null)
  return ctx.db.prepare(`${TARGET} WHERE id = ?`).get(r.lastInsertRowid) as TargetRow
}
export function removeTarget(ctx: Ctx, id: number): void {
  const r = ctx.db.prepare('DELETE FROM labor_targets WHERE org_id = ? AND id = ?').run(ctx.orgId, id)
  if (!r.changes) throw new NotFoundError('Objetivo no encontrado')
}

// ─── Importación CSV ─────────────────────────────────────────────────────

export const SHIFT_FIELDS = ['location', 'date', 'employee_code', 'employee_name', 'role', 'service', 'start_time', 'end_time', 'break_minutes', 'hourly_cost', 'actual_hours'] as const
export const SALES_FIELDS = ['location', 'date', 'slot_start', 'slot_end', 'channel', 'net_sales', 'covers', 'orders', 'tickets'] as const

export const importSchema = z.object({
  type: z.enum(['shifts', 'sales']),
  rows: z.array(z.record(z.string(), z.string().nullable())).min(1, 'El fichero no tiene filas').max(20000),
  /** { columnaCsv: campo } */
  mapping: z.record(z.string(), z.string()),
})

export interface ImportReport {
  inserted: number; skipped: number; total: number
  errors: { row: number; reason: string }[]
  link?: { linked: number; unlinked: number; unlinkedNames: string[] }
}

/** Importa turnos o ventas. Reimportar el mismo fichero no duplica nada. */
export function importCsv(ctx: Ctx, input: unknown): ImportReport {
  const d = importSchema.parse(input)
  const locations = listLocations(ctx)
  const locByCode = new Map(locations.map(l => [l.code.toLowerCase(), l.id] as const))
  const locByName = new Map(locations.map(l => [l.name.toLowerCase(), l.id] as const))
  const employees = listEmployees(ctx, { includeInactive: true })
  const empByCode = new Map(employees.filter(e => e.code).map(e => [e.code!.toLowerCase(), e] as const))
  const report: ImportReport = { inserted: 0, skipped: 0, total: d.rows.length, errors: [] }
  const unlinked = new Set<string>()
  let linked = 0

  const resolveLocation = (raw: string | undefined): number | null | undefined => {
    if (!raw) return null
    const id = locByCode.get(raw.toLowerCase()) ?? locByName.get(raw.toLowerCase())
    return id ?? undefined
  }

  const tx = ctx.db.transaction(() => {
    d.rows.forEach((raw, idx) => {
      const row: Record<string, string> = {}
      for (const [col, field] of Object.entries(d.mapping)) if (field && field !== '__skip__') row[field] = (raw[col] ?? '').toString().trim()
      const n = idx + 1
      try {
        const location = resolveLocation(row.location)
        if (location === undefined) { report.errors.push({ row: n, reason: `Centro desconocido: "${row.location}"` }); return }
        const date = parseDate(row.date)
        if (!date) { report.errors.push({ row: n, reason: `Fecha no válida: "${row.date}"` }); return }
        if (d.type === 'shifts') {
          const start = parseHm(row.start_time), end = parseHm(row.end_time)
          if (!start || !end) { report.errors.push({ row: n, reason: `Hora no válida (${row.start_time} - ${row.end_time})` }); return }
          const emp = (row.employee_code && empByCode.get(row.employee_code.toLowerCase())) || (row.employee_name && employees.find(e => e.name.toLowerCase() === row.employee_name.toLowerCase())) || null
          if (emp) linked++; else if (row.employee_name || row.employee_code) unlinked.add(row.employee_name || row.employee_code)
          const s = buildShift(ctx, {
            shiftDate: date, startTime: start, endTime: end, breakMinutes: Math.round(parseEuNumber(row.break_minutes) ?? 0),
            employeeId: emp?.id ?? null, employeeName: row.employee_name || emp?.name || null, role: row.role || null, service: row.service || null,
            locationId: location, hourlyCost: parseEuNumber(row.hourly_cost), actualHours: parseEuNumber(row.actual_hours), source: 'csv',
          }, employees)
          const r = ctx.db.prepare(INSERT_SHIFT).run(ctx.orgId, s.location_id, s.employee_id, s.employee_name, s.role, s.service, s.shift_date, s.start_time, s.end_time, s.break_minutes, s.planned_hours, s.actual_hours, s.hourly_cost, s.overnight, s.source)
          if (r.changes) report.inserted++; else report.skipped++
        } else {
          const start = parseHm(row.slot_start), end = row.slot_end ? parseHm(row.slot_end) : null
          if (!start || (row.slot_end && !end)) { report.errors.push({ row: n, reason: `Franja no válida (${row.slot_start} - ${row.slot_end})` }); return }
          const net = parseEuNumber(row.net_sales) ?? 0
          if (net < 0) { report.errors.push({ row: n, reason: 'Ventas negativas' }); return }
          const int = (v: string) => { const x = parseEuNumber(v); return x == null ? null : Math.round(x) }
          const r = ctx.db.prepare(INSERT_SLOT).run(ctx.orgId, location, date, start, end, row.channel || 'sala', net, int(row.covers), int(row.orders), int(row.tickets), 'csv')
          if (r.changes) report.inserted++; else report.skipped++
        }
      } catch (e: any) {
        report.errors.push({ row: n, reason: e.message })
      }
    })
  })
  tx()
  if (d.type === 'shifts') report.link = { linked, unlinked: unlinked.size, unlinkedNames: Array.from(unlinked).slice(0, 20) }
  return report
}

// ─── Resúmenes ───────────────────────────────────────────────────────────

function defaultRange(r: Range) {
  const to = r.to ? parseDate(r.to) : today()
  const from = r.from ? parseDate(r.from) : addDays(to ?? today(), -7)
  if (!from || !to) throw new ValidationError('Rango de fechas no válido')
  if (from > to) throw new ValidationError('La fecha inicial es posterior a la final')
  return { from, to, locationId: r.locationId ?? null }
}

export function laborSummary(ctx: Ctx, r: Range = {}) {
  const range = defaultRange(r)
  const shifts = listShifts(ctx, range), sales = listSalesSlots(ctx, range)
  const summary = summarizeLabor(shifts, sales)
  return {
    summary, ...range,
    dq: {
      has_shifts: shifts.length > 0, has_sales: sales.length > 0,
      // every() sobre vacío es true: exigir que haya turnos.
      has_hourly_cost: shifts.length > 0 && shifts.every(s => s.hourly_cost != null),
      data_quality: shifts.length > 0 && sales.length > 0 ? 'OK' : 'PARCIAL',
    },
  }
}

/** Gasto en compras del periodo: facturas (verdad contable). */
export function purchasesSpend(ctx: Ctx, from: string, to: string): number {
  const r = ctx.db.prepare('SELECT COALESCE(SUM(total_cents), 0) AS c FROM invoices WHERE org_id = ? AND invoice_date BETWEEN ? AND ?').get(ctx.orgId, from, to) as { c: number }
  return fromCents(r.c)
}

export function productivitySummary(ctx: Ctx, r: Range = {}) {
  const range = defaultRange(r)
  const shifts = listShifts(ctx, range), sales = listSalesSlots(ctx, range), targets = listTargets(ctx, range.locationId)
  const spend = purchasesSpend(ctx, range.from, range.to)
  const summary = summarizeProductivity(shifts, sales, targets, spend > 0 ? spend : null)
  const withActual = shifts.filter(s => s.actual_hours != null).length
  return {
    summary, ...range,
    // Sin fichajes se usan horas PLAN: la interfaz no debe llamarlas "trabajadas".
    hours_source: shifts.length === 0 ? 'none' : withActual === 0 ? 'planned' : withActual === shifts.length ? 'actual' : 'mixed',
    shifts_with_actual: withActual, shifts_total: shifts.length,
  }
}

export const idealShiftSchema = z.object({
  forecast: z.array(z.object({ slot: z.string().min(1), ventas: z.number().min(0), servicio: z.string().optional() })).min(1),
  targetSplh: z.number().gt(0, 'Hace falta un objetivo de ventas por hora'),
  targetsByService: z.record(z.string(), z.number()).optional(),
  avgHourlyCost: z.number().min(0).optional().nullable(),
  plan: z.array(z.object({ slot: z.string(), horas: z.number().min(0) })).optional(),
  date: z.string().optional().nullable(),
  locationId: z.number().int().positive().optional().nullable(),
})

export function idealShiftForDay(ctx: Ctx, input: unknown) {
  const d = idealShiftSchema.parse(input)
  for (const f of d.forecast) if (!parseSlotLabel(f.slot)) throw new ValidationError(`Franja no válida: "${f.slot}" (usa HH:MM–HH:MM)`)
  let avgCost = d.avgHourlyCost ?? 0
  if (!avgCost) {
    const r = ctx.db.prepare('SELECT AVG(hourly_cost) AS avg FROM employees WHERE org_id = ? AND active = 1 AND hourly_cost > 0').get(ctx.orgId) as { avg: number | null }
    avgCost = r.avg ?? 12
  }
  let plan = d.plan ?? []
  if (plan.length === 0 && d.date) {
    const date = parseDate(d.date)
    if (!date) throw new ValidationError('Fecha no válida')
    const shifts = listShifts(ctx, { from: date, to: date, locationId: d.locationId })
    plan = d.forecast.map(f => {
      const s = parseSlotLabel(f.slot)!
      return { slot: f.slot, horas: shifts.reduce((acc, t) => acc + overlapHours(t, s.start, s.end), 0) }
    })
  }
  const input2: IdealShiftInput = { forecast: d.forecast, target_splh: d.targetSplh, targets_por_servicio: d.targetsByService, coste_medio_hora: avgCost, plan }
  const slots = idealShift(input2)
  const totales = slots.reduce((a, s) => ({
    horas_ideales: a.horas_ideales + s.horas_ideales, coste_ideal: a.coste_ideal + s.coste_ideal, horas_plan: a.horas_plan + s.horas_plan,
    coste_plan: a.coste_plan + s.coste_plan, delta_horas: a.delta_horas + s.delta_horas, delta_coste: a.delta_coste + s.delta_coste, ventas: a.ventas + s.ventas_previstas,
  }), { horas_ideales: 0, coste_ideal: 0, horas_plan: 0, coste_plan: 0, delta_horas: 0, delta_coste: 0, ventas: 0 })
  const r2 = (n: number) => Math.round(n * 100) / 100
  return {
    slots, avgHourlyCost: r2(avgCost),
    totales: Object.fromEntries(Object.entries(totales).map(([k, v]) => [k, r2(v)])),
    alertas: slots.filter(s => s.status !== 'ok').map(s => ({ slot: s.slot, status: s.status, recomendacion: s.recomendacion })),
  }
}

export { isHm }
