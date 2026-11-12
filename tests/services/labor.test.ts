import { beforeEach, describe, expect, it } from 'vitest'
import { createEmployee, createLocation, createSalesSlot, createShift, createTarget, idealShiftForDay, importCsv, laborSummary, listShifts, productivitySummary, removeShift, updateShift } from '@/server/services/labor'
import type { Ctx } from '@/server/http/context'
import { testCtx } from '../helpers'

let ctx: Ctx
beforeEach(() => { ctx = testCtx() })

describe('turnos', () => {
  it('hereda coste y rol del empleado, calcula horas plan y no duplica', () => {
    createEmployee(ctx, { name: 'Ana', role: 'Sala', hourlyCost: 11 })
    const s = createShift(ctx, { shiftDate: '10/11/2026', startTime: '12:00', endTime: '16:30', breakMinutes: 30, employeeName: 'ana' })
    expect(s).toMatchObject({ shift_date: '2026-11-10', employee_name: 'Ana', role: 'Sala', hourly_cost: 11, planned_hours: 4, overnight: 0 })
    expect(s.employee_id).not.toBeNull()
    expect(() => createShift(ctx, { shiftDate: '2026-11-10', startTime: '12:00', endTime: '16:30', employeeName: 'Ana' })).toThrow(/ya existe/)
    expect(() => createShift(ctx, { shiftDate: '2026-11-10', startTime: '25:00', endTime: '16:30' })).toThrow(/Hora no válida/)
    expect(() => createShift(ctx, { shiftDate: '2026-11-10', startTime: '12:00', endTime: '12:15', breakMinutes: 30 })).toThrow(/no tiene horas/)
  })
  it('turno nocturno, edición y borrado', () => {
    const s = createShift(ctx, { shiftDate: '2026-11-10', startTime: '22:00', endTime: '02:00', employeeName: 'Luis', hourlyCost: 9 })
    expect(s).toMatchObject({ overnight: 1, planned_hours: 4 })
    const u = updateShift(ctx, s.id, { endTime: '03:00', actualHours: 5.5 })
    expect(u).toMatchObject({ planned_hours: 5, actual_hours: 5.5 })
    removeShift(ctx, s.id)
    expect(listShifts(ctx)).toEqual([])
    expect(() => removeShift(ctx, s.id)).toThrow(/no encontrado/)
  })
  it('otra organización no ve los turnos', () => {
    createShift(ctx, { shiftDate: '2026-11-10', startTime: '12:00', endTime: '16:00', employeeName: 'Ana' })
    expect(listShifts(testCtx(ctx.db, 'Otra'))).toEqual([])
  })
})

describe('importación CSV', () => {
  const rows = [
    { Fecha: '10/11/2026', Persona: 'Ana', Entrada: '12:00', Salida: '16:00', Coste: '11,50', Centro: 'bcn' },
    { Fecha: '10/11/2026', Persona: 'Luis', Entrada: '19:00', Salida: '23:00', Coste: '', Centro: 'bcn' },
    { Fecha: 'ayer', Persona: 'Pepe', Entrada: '19:00', Salida: '23:00', Coste: '', Centro: 'bcn' },
    { Fecha: '11/11/2026', Persona: 'Ana', Entrada: '12:00', Salida: '16:00', Coste: '', Centro: 'madrid' },
  ]
  const mapping = { Fecha: 'date', Persona: 'employee_name', Entrada: 'start_time', Salida: 'end_time', Coste: 'hourly_cost', Centro: 'location' }
  it('inserta lo válido, explica cada fila mala, vincula con el maestro y reimportar no duplica', () => {
    createLocation(ctx, { code: 'BCN', name: 'Barcelona' })
    createEmployee(ctx, { name: 'Ana', hourlyCost: 10 })
    const r = importCsv(ctx, { type: 'shifts', rows, mapping })
    expect(r).toMatchObject({ inserted: 2, skipped: 0, total: 4 })
    expect(r.errors.map(e => e.row)).toEqual([3, 4])
    expect(r.errors[0].reason).toMatch(/Fecha no válida/)
    expect(r.errors[1].reason).toMatch(/Centro desconocido/)
    expect(r.link).toEqual({ linked: 1, unlinked: 1, unlinkedNames: ['Luis'] })
    const shifts = listShifts(ctx)
    expect(shifts.find(s => s.employee_name === 'Ana')?.hourly_cost).toBe(11.5)
    const again = importCsv(ctx, { type: 'shifts', rows, mapping })
    expect(again).toMatchObject({ inserted: 0, skipped: 2 })
    expect(listShifts(ctx)).toHaveLength(2)
  })
  it('ventas por franja con formato europeo', () => {
    const r = importCsv(ctx, { type: 'sales', rows: [{ d: '2026-11-10', s: '12:00', e: '16:00', v: '1.250,50', c: '' }, { d: '2026-11-10', s: '12:00', e: '16:00', v: '1', c: '' }],
                               mapping: { d: 'date', s: 'slot_start', e: 'slot_end', v: 'net_sales', c: 'channel' } })
    expect(r).toMatchObject({ inserted: 1, skipped: 1 })
    expect(laborSummary(ctx, { from: '2026-11-10', to: '2026-11-10' }).summary.ventas_netas).toBe(1250.5)
  })
})

describe('resúmenes', () => {
  it('labor, productividad y turno ideal leen de la BD', () => {
    createShift(ctx, { shiftDate: '2026-11-10', startTime: '12:00', endTime: '16:00', employeeName: 'Ana', hourlyCost: 10 })
    createSalesSlot(ctx, { saleDate: '2026-11-10', slotStart: '12:00', slotEnd: '16:00', netSales: 200 })
    createTarget(ctx, { targetSplh: 100 })
    const l = laborSummary(ctx, { from: '2026-11-10', to: '2026-11-10' })
    expect(l.summary).toMatchObject({ horas_plan: 4, coste_total: 40, labor_pct: 20, splh: 50 })
    expect(l.dq).toMatchObject({ data_quality: 'OK', has_hourly_cost: true })
    const p = productivitySummary(ctx, { from: '2026-11-10', to: '2026-11-10' })
    expect(p.hours_source).toBe('planned')
    expect(p.summary.por_franja[0].status).toBe('crit')
    const ideal = idealShiftForDay(ctx, { forecast: [{ slot: '12:00–16:00', ventas: 200 }], targetSplh: 100, date: '2026-11-10', avgHourlyCost: 10 })
    expect(ideal.slots[0]).toMatchObject({ horas_plan: 4, horas_ideales: 2, status: 'sobredotacion' })
    expect(ideal.totales).toMatchObject({ delta_horas: 2, delta_coste: 20 })
    expect(() => idealShiftForDay(ctx, { forecast: [{ slot: 'mediodía', ventas: 1 }], targetSplh: 1 })).toThrow(/Franja no válida/)
  })
  it('sin datos: dq PARCIAL, sin costes/hora no se afirma que los haya', () => {
    const l = laborSummary(ctx)
    expect(l.dq).toMatchObject({ data_quality: 'PARCIAL', has_hourly_cost: false })
    expect(() => laborSummary(ctx, { from: '2026-12-01', to: '2026-11-01' })).toThrow(/posterior/)
  })
})
