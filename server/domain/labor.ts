// Motor de labor cost, productividad y turno ideal. Funciones puras: ni BD
// ni fechas "de hoy". Entradas con los nombres de columna de v2; las salidas
// conservan las claves que ya pintan las pantallas de labor y el daily brief.
import { parseHm } from './dates'

export interface Shift {
  shift_date: string
  start_time: string
  end_time: string
  break_minutes: number
  hourly_cost: number | null
  role: string | null
  location_id: number | null
  service?: string | null
  planned_hours?: number | null
  actual_hours?: number | null
}

export interface SalesSlot {
  sale_date: string
  slot_start: string
  slot_end: string | null
  net_sales: number
  covers?: number | null
  orders?: number | null
  tickets?: number | null
  channel?: string | null
  location_id?: number | null
}

export interface LaborTarget {
  service?: string | null
  role?: string | null
  target_labor_pct?: number | null
  target_splh?: number | null
  min_staff?: number | null
  max_staff?: number | null
}

export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function isOvernight(start: string, end: string): boolean {
  return hmToMinutes(end) <= hmToMinutes(start)
}

/** Minutos entre dos horas; si el fin es anterior o igual al inicio, cruza la medianoche. */
export function minutesBetween(start: string, end: string): number {
  const a = hmToMinutes(start), b = hmToMinutes(end)
  return b > a ? b - a : 24 * 60 - a + b
}

/** Horas netas del turno: brutas menos descanso, nunca negativas. */
export function netHours(s: Pick<Shift, 'start_time' | 'end_time' | 'break_minutes'>): number {
  const minutes = minutesBetween(s.start_time, s.end_time) - (s.break_minutes || 0)
  return Math.max(0, minutes / 60)
}

export function shiftCost(s: Shift): number {
  if (!s.hourly_cost) return 0
  return (s.planned_hours ?? netHours(s)) * s.hourly_cost
}

export function serviceForSlot(hm: string): string {
  const mins = hmToMinutes(hm)
  if (mins < 11 * 60) return 'Desayuno'
  if (mins < 16 * 60) return 'Comida'
  if (mins < 19 * 60) return 'Entre servicios'
  return 'Cena'
}

export function slotLabel(start: string, end: string | null): string {
  return `${start}–${end ?? ''}`
}

export function parseSlotLabel(label: string): { start: string; end: string } | null {
  const [s, e] = label.split(/[–-]/).map(x => parseHm(x.trim()))
  return s && e ? { start: s, end: e } : null
}

// ─── Labor summary ───────────────────────────────────────────────────────

export interface LaborSummary {
  horas_plan: number
  horas_real: number
  coste_total: number
  coste_medio_hora: number
  ventas_netas: number
  labor_pct: number | null
  splh: number | null
  por_rol: { rol: string; horas: number; coste: number; pct: number }[]
  por_servicio: { servicio: string; horas: number; coste: number; ventas: number; labor_pct: number | null }[]
  por_centro: { location_id: number | null; horas: number; coste: number; ventas: number; labor_pct: number | null }[]
  por_dia: { fecha: string; horas: number; coste: number; ventas: number; labor_pct: number | null; splh: number | null }[]
}

type Acc = { horas: number; coste: number }
function add(map: Record<string, Acc>, key: string, h: number, c: number) {
  const cur = map[key] ?? (map[key] = { horas: 0, coste: 0 })
  cur.horas += h; cur.coste += c
}

export function summarizeLabor(shifts: Shift[], sales: SalesSlot[]): LaborSummary {
  let horasPlan = 0, horasReal = 0, costeTotal = 0
  const porRol: Record<string, Acc> = {}, porServicio: Record<string, Acc> = {}, porCentro: Record<string, Acc> = {}, porDia: Record<string, Acc> = {}

  for (const s of shifts) {
    const h = s.planned_hours ?? netHours(s)
    const hr = s.actual_hours ?? h
    const c = h * (s.hourly_cost || 0)
    horasPlan += h; horasReal += hr; costeTotal += c
    add(porRol, s.role || '—', h, c)
    add(porServicio, s.service || 'All day', h, c)
    add(porCentro, String(s.location_id ?? ''), h, c)
    add(porDia, s.shift_date, h, c)
  }

  let ventasTotales = 0
  const ventasDia: Record<string, number> = {}, ventasCentro: Record<string, number> = {}, ventasServicio: Record<string, number> = {}
  for (const v of sales) {
    ventasTotales += v.net_sales
    ventasDia[v.sale_date] = (ventasDia[v.sale_date] || 0) + v.net_sales
    const centro = String(v.location_id ?? '')
    ventasCentro[centro] = (ventasCentro[centro] || 0) + v.net_sales
    const serv = serviceForSlot(v.slot_start)
    ventasServicio[serv] = (ventasServicio[serv] || 0) + v.net_sales
  }

  const pct = (coste: number, ventas: number) => ventas > 0 ? round1((coste / ventas) * 100) : null

  return {
    horas_plan: round1(horasPlan),
    horas_real: round1(horasReal),
    coste_total: round2(costeTotal),
    coste_medio_hora: horasPlan > 0 ? round2(costeTotal / horasPlan) : 0,
    ventas_netas: round2(ventasTotales),
    labor_pct: pct(costeTotal, ventasTotales),
    splh: horasPlan > 0 ? round1(ventasTotales / horasPlan) : null,
    por_rol: Object.entries(porRol)
      .map(([rol, v]) => ({ rol, horas: round1(v.horas), coste: round2(v.coste), pct: costeTotal > 0 ? round1((v.coste / costeTotal) * 100) : 0 }))
      .sort((a, b) => b.coste - a.coste),
    por_servicio: Object.entries(porServicio)
      .map(([servicio, v]) => ({ servicio, horas: round1(v.horas), coste: round2(v.coste), ventas: round2(ventasServicio[servicio] || 0), labor_pct: pct(v.coste, ventasServicio[servicio] || 0) }))
      .sort((a, b) => b.coste - a.coste),
    por_centro: Object.entries(porCentro)
      .map(([k, v]) => ({ location_id: k === '' ? null : Number(k), horas: round1(v.horas), coste: round2(v.coste), ventas: round2(ventasCentro[k] || 0), labor_pct: pct(v.coste, ventasCentro[k] || 0) })),
    por_dia: Object.entries(porDia)
      .map(([fecha, v]) => ({ fecha, horas: round1(v.horas), coste: round2(v.coste), ventas: round2(ventasDia[fecha] || 0), labor_pct: pct(v.coste, ventasDia[fecha] || 0), splh: v.horas > 0 ? round1((ventasDia[fecha] || 0) / v.horas) : null }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
  }
}

// ─── Productividad ───────────────────────────────────────────────────────

export interface SlotProductivity { slot: string; ventas: number; horas: number; splh: number | null; target_splh: number | null; status: 'ok' | 'warn' | 'crit' }

export interface ProductivitySummary {
  splh: number | null
  ventas_por_empleado: number | null
  tickets_por_hora: number | null
  covers_por_hora: number | null
  productividad_index: number | null
  prime_cost_pct: number | null
  coste_ineficiencia: number | null
  por_franja: SlotProductivity[]
}

export function summarizeProductivity(shifts: Shift[], sales: SalesSlot[], targets: LaborTarget[], foodCostEur: number | null = null): ProductivitySummary {
  let totalHoras = 0, totalCoste = 0, totalVentas = 0, totalTickets = 0, totalCovers = 0
  const empleados = new Set<string>()
  for (const s of shifts) {
    const h = s.planned_hours ?? netHours(s)
    totalHoras += h
    totalCoste += h * (s.hourly_cost || 0)
    empleados.add(`${s.location_id ?? ''}|${s.role ?? ''}|${s.shift_date}|${s.start_time}`)
  }
  for (const v of sales) { totalVentas += v.net_sales; totalTickets += v.tickets || 0; totalCovers += v.covers || 0 }

  const targetSplhDefault = targets.find(t => !t.role && (!t.service || t.service === 'All day'))?.target_splh || null
  const porFranja = aggregateBySlot(shifts, sales, targets, targetSplhDefault)

  const costeMedio = totalHoras > 0 ? totalCoste / totalHoras : 0
  let costeInef = 0
  for (const f of porFranja) {
    if (f.target_splh && f.target_splh > 0) costeInef += Math.max(0, f.horas - f.ventas / f.target_splh) * costeMedio
  }

  const splh = totalHoras > 0 ? totalVentas / totalHoras : null
  return {
    splh: splh != null ? round1(splh) : null,
    ventas_por_empleado: empleados.size > 0 ? round2(totalVentas / empleados.size) : null,
    tickets_por_hora: totalHoras > 0 && totalTickets > 0 ? round1(totalTickets / totalHoras) : null,
    covers_por_hora: totalHoras > 0 && totalCovers > 0 ? round1(totalCovers / totalHoras) : null,
    productividad_index: splh != null && targetSplhDefault && targetSplhDefault > 0 ? Math.min(100, Math.round((splh / targetSplhDefault) * 100)) : null,
    prime_cost_pct: foodCostEur != null && totalVentas > 0 ? round1(((foodCostEur + totalCoste) / totalVentas) * 100) : null,
    // Sin horas o sin ventas no hay dato, no "cero sobrecoste".
    coste_ineficiencia: totalHoras > 0 && totalVentas > 0 ? round2(costeInef) : null,
    por_franja: porFranja,
  }
}

/** Horas de un turno que caen dentro de una franja [start, end). */
export function overlapHours(s: Pick<Shift, 'start_time' | 'end_time' | 'break_minutes' | 'planned_hours'>, slotStart: string, slotEnd: string): number {
  const tStart = hmToMinutes(s.start_time)
  const tEnd = isOvernight(s.start_time, s.end_time) ? hmToMinutes(s.end_time) + 1440 : hmToMinutes(s.end_time)
  const sStart = hmToMinutes(slotStart)
  const sEnd = hmToMinutes(slotEnd) <= sStart ? hmToMinutes(slotEnd) + 1440 : hmToMinutes(slotEnd)
  const overlap = Math.max(0, Math.min(tEnd, sEnd) - Math.max(tStart, sStart))
  if (overlap <= 0 || tEnd <= tStart) return 0
  const horas = s.planned_hours ?? netHours({ ...s, break_minutes: s.break_minutes || 0 })
  return horas * (overlap / (tEnd - tStart))
}

function aggregateBySlot(shifts: Shift[], sales: SalesSlot[], targets: LaborTarget[], defaultTarget: number | null): SlotProductivity[] {
  const slots: Record<string, { ventas: number; horas: number; servicio: string; start: string; end: string }> = {}
  for (const v of sales) {
    if (!v.slot_end) continue
    const key = slotLabel(v.slot_start, v.slot_end)
    const cur = slots[key] ?? (slots[key] = { ventas: 0, horas: 0, servicio: serviceForSlot(v.slot_start), start: v.slot_start, end: v.slot_end })
    cur.ventas += v.net_sales
  }
  for (const s of shifts) {
    for (const k of Object.keys(slots)) slots[k].horas += overlapHours(s, slots[k].start, slots[k].end)
  }
  return Object.entries(slots).map(([slot, d]) => {
    const target = targets.find(t => t.service && t.service === d.servicio)?.target_splh || defaultTarget
    const splh = d.horas > 0 ? d.ventas / d.horas : null
    let status: SlotProductivity['status'] = 'ok'
    if (target && splh != null) { const r = splh / target; status = r < 0.6 ? 'crit' : r < 0.85 ? 'warn' : 'ok' }
    return { slot, ventas: round2(d.ventas), horas: round1(d.horas), splh: splh != null ? round1(splh) : null, target_splh: target ?? null, status }
  }).sort((a, b) => a.slot.localeCompare(b.slot))
}

// ─── Turno ideal ─────────────────────────────────────────────────────────

export interface IdealShiftSlot {
  slot: string; servicio: string; ventas_previstas: number; target_splh: number
  horas_ideales: number; coste_ideal: number; horas_plan: number; coste_plan: number
  delta_horas: number; delta_coste: number
  status: 'sobredotacion' | 'subdotacion' | 'ok'; recomendacion: string
}

export interface IdealShiftInput {
  forecast: { slot: string; ventas: number; servicio?: string }[]
  target_splh: number
  targets_por_servicio?: Record<string, number>
  coste_medio_hora: number
  plan?: { slot: string; horas: number }[]
}

export function idealShift(input: IdealShiftInput): IdealShiftSlot[] {
  const plan: Record<string, number> = {}
  for (const p of input.plan || []) plan[p.slot] = p.horas
  return input.forecast.map(f => {
    const servicio = f.servicio || serviceForSlot(f.slot.split(/[–-]/)[0].trim())
    const target = input.targets_por_servicio?.[servicio] || input.target_splh
    const horasIdeales = target > 0 ? f.ventas / target : 0
    const costeIdeal = horasIdeales * input.coste_medio_hora
    const horasPlan = plan[f.slot] || 0
    const costePlan = horasPlan * input.coste_medio_hora
    const deltaH = horasPlan - horasIdeales, deltaC = costePlan - costeIdeal
    let status: IdealShiftSlot['status'] = 'ok'
    let recomendacion = `Cobertura correcta para ${servicio.toLowerCase()}`
    if (horasIdeales <= 0.01) {
      if (horasPlan > 0.5) { status = 'sobredotacion'; recomendacion = `Sin ventas previstas: reduce ${round1(horasPlan)}h en ${f.slot} · ahorra ${round2(costePlan)}€` }
      else recomendacion = 'Sin actividad prevista en esta franja'
    } else if (horasPlan <= 0.01) {
      status = 'subdotacion'; recomendacion = `Sin plantilla: planifica ${round1(horasIdeales)}h en ${f.slot}`
    } else if (deltaH > 1) {
      status = 'sobredotacion'; recomendacion = `Exceso de plantilla: reduce ${round1(deltaH)}h en ${f.slot} · ahorra ${round2(deltaC)}€`
    } else if (deltaH < -0.5) {
      status = 'subdotacion'; recomendacion = `Falta cobertura: refuerza ${round1(Math.abs(deltaH))}h en ${f.slot}`
    }
    return { slot: f.slot, servicio, ventas_previstas: round2(f.ventas), target_splh: target, horas_ideales: round1(horasIdeales), coste_ideal: round2(costeIdeal),
             horas_plan: round1(horasPlan), coste_plan: round2(costePlan), delta_horas: round1(deltaH), delta_coste: round2(deltaC), status, recomendacion }
  })
}

/** Número europeo tolerante: "1.450,80" → 1450.8, "11,50" → 11.5, "12 €" → 12. */
export function parseEuNumber(v: string | number | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).trim().replace(/[€\s]/g, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (s.includes(',')) s = s.replace(',', '.')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function round1(n: number) { return Math.round(n * 10) / 10 }
function round2(n: number) { return Math.round(n * 100) / 100 }
