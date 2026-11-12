import { describe, expect, it } from 'vitest'
import { idealShift, netHours, overlapHours, parseEuNumber, parseSlotLabel, serviceForSlot, summarizeLabor, summarizeProductivity, type SalesSlot, type Shift } from '@/server/domain/labor'

const shift = (o: Partial<Shift>): Shift => ({ shift_date: '2026-11-10', start_time: '12:00', end_time: '16:00', break_minutes: 0, hourly_cost: 10, role: 'Sala', location_id: null, ...o })
const sale = (o: Partial<SalesSlot>): SalesSlot => ({ sale_date: '2026-11-10', slot_start: '12:00', slot_end: '16:00', net_sales: 400, ...o })

describe('horas de turno', () => {
  it('resta el descanso y entiende los turnos que cruzan la medianoche', () => {
    expect(netHours({ start_time: '12:00', end_time: '16:30', break_minutes: 30 })).toBe(4)
    expect(netHours({ start_time: '22:00', end_time: '02:00', break_minutes: 0 })).toBe(4)
    expect(netHours({ start_time: '10:00', end_time: '10:30', break_minutes: 60 })).toBe(0)
  })
  it('prorratea un turno sobre una franja por solape', () => {
    const s = { start_time: '12:00', end_time: '16:00', break_minutes: 0 }
    expect(overlapHours(s, '13:00', '15:00')).toBe(2)
    expect(overlapHours(s, '18:00', '20:00')).toBe(0)
    expect(overlapHours({ ...s, planned_hours: 3 }, '12:00', '14:00')).toBe(1.5)
  })
  it('servicios por hora y etiquetas de franja', () => {
    expect(serviceForSlot('09:00')).toBe('Desayuno')
    expect(serviceForSlot('14:00')).toBe('Comida')
    expect(serviceForSlot('21:00')).toBe('Cena')
    expect(parseSlotLabel('13:00–15:00')).toEqual({ start: '13:00', end: '15:00' })
    expect(parseSlotLabel('13:00-15:00')).toEqual({ start: '13:00', end: '15:00' })
    expect(parseSlotLabel('tarde')).toBeNull()
  })
})

describe('resumen de labor', () => {
  it('labor % y SPLH, y null cuando falta un lado', () => {
    const s = summarizeLabor([shift({}), shift({ start_time: '19:00', end_time: '23:00', hourly_cost: 12, role: 'Cocina' })], [sale({}), sale({ slot_start: '19:00', slot_end: '23:00', net_sales: 600 })])
    expect(s.horas_plan).toBe(8)
    expect(s.coste_total).toBe(88)
    expect(s.ventas_netas).toBe(1000)
    expect(s.labor_pct).toBe(8.8)
    expect(s.splh).toBe(125)
    expect(s.por_rol[0]).toMatchObject({ rol: 'Cocina', coste: 48, pct: 54.5 })
    expect(summarizeLabor([shift({})], []).labor_pct).toBeNull()
    expect(summarizeLabor([], [sale({})]).splh).toBeNull()
  })
  it('usa las horas plan guardadas si existen y las reales para horas_real', () => {
    const s = summarizeLabor([shift({ planned_hours: 3, actual_hours: 3.5 })], [])
    expect(s.horas_plan).toBe(3)
    expect(s.horas_real).toBe(3.5)
    expect(s.coste_total).toBe(30)
  })
})

describe('productividad', () => {
  it('semáforo por franja contra el objetivo y coste de ineficiencia', () => {
    const p = summarizeProductivity([shift({})], [sale({ net_sales: 200 })], [{ target_splh: 100 }])
    expect(p.splh).toBe(50)
    expect(p.productividad_index).toBe(50)
    expect(p.por_franja[0]).toMatchObject({ slot: '12:00–16:00', horas: 4, splh: 50, target_splh: 100, status: 'crit' })
    // ideal: 200/100 = 2 h; plan 4 h; exceso 2 h × 10 €/h
    expect(p.coste_ineficiencia).toBe(20)
  })
  it('sin ventas o sin horas, la ineficiencia es null, no cero', () => {
    expect(summarizeProductivity([shift({})], [], [{ target_splh: 100 }]).coste_ineficiencia).toBeNull()
    expect(summarizeProductivity([], [sale({})], [{ target_splh: 100 }]).coste_ineficiencia).toBeNull()
  })
})

describe('turno ideal', () => {
  it('plan vacío con ventas previstas nunca es ok; exceso y falta se nombran', () => {
    const r = idealShift({ forecast: [{ slot: '12:00–16:00', ventas: 400 }, { slot: '19:00–23:00', ventas: 400 }, { slot: '16:00–19:00', ventas: 0 }], target_splh: 100, coste_medio_hora: 10,
                           plan: [{ slot: '12:00–16:00', horas: 7 }, { slot: '16:00–19:00', horas: 2 }] })
    expect(r[0]).toMatchObject({ servicio: 'Comida', horas_ideales: 4, horas_plan: 7, delta_horas: 3, status: 'sobredotacion' })
    expect(r[1]).toMatchObject({ servicio: 'Cena', horas_plan: 0, status: 'subdotacion' })
    expect(r[2]).toMatchObject({ status: 'sobredotacion' })
    expect(r[2].recomendacion).toMatch(/Sin ventas previstas/)
  })
})

describe('números europeos', () => {
  it('acepta coma decimal, punto de miles y símbolo', () => {
    expect(parseEuNumber('1.450,80')).toBe(1450.8)
    expect(parseEuNumber('11,50')).toBe(11.5)
    expect(parseEuNumber('1,450.80')).toBe(1450.8)
    expect(parseEuNumber('12 €')).toBe(12)
    expect(parseEuNumber('')).toBeNull()
    expect(parseEuNumber('abc')).toBeNull()
  })
})
