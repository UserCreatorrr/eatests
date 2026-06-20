// MarginBite — Labor Cost + Productivity + Turno Ideal math engine.
// Pure functions, tested via interface contract. No DB calls here.

export interface Turno {
  fecha: string
  start_time: string         // HH:MM
  end_time: string
  break_minutes: number
  coste_hora: number | null
  rol: string | null
  site_id: string | null
  servicio?: string | null
  horas_plan?: number | null
  horas_real?: number | null
}

export interface VentaFranja {
  fecha: string
  timeslot_start: string     // HH:MM
  timeslot_end: string
  sales_net: number
  covers?: number | null
  orders?: number | null
  tickets?: number | null
  channel?: string | null
  site_id?: string | null
}

export interface Target {
  servicio?: string | null
  rol?: string | null
  target_labor_pct?: number | null
  target_splh?: number | null
  min_staff_role?: number | null
  max_staff_role?: number | null
}

// ──────────────────────────────────────────────────────────────
// Time helpers
// ──────────────────────────────────────────────────────────────

export function parseHM(hm: string): number {
  // Returns minutes from 00:00. "14:30" → 870
  const [h, m] = hm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function minutesBetween(start: string, end: string, overnight = false): number {
  const a = parseHM(start)
  const b = parseHM(end)
  if (b > a && !overnight) return b - a
  // overnight or end before start: assume crosses midnight
  return (24 * 60 - a) + b
}

// Horas netas = horas brutas - descanso
export function netHours(t: Turno): number {
  const overnight = parseHM(t.end_time) <= parseHM(t.start_time)
  const minutes = minutesBetween(t.start_time, t.end_time, overnight) - (t.break_minutes || 0)
  return Math.max(0, minutes / 60)
}

export function turnoCoste(t: Turno): number {
  if (!t.coste_hora) return 0
  return netHours(t) * t.coste_hora
}

// ──────────────────────────────────────────────────────────────
// Aggregations
// ──────────────────────────────────────────────────────────────

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
  por_centro: { site_id: string; horas: number; coste: number; ventas: number; labor_pct: number | null }[]
  por_dia: { fecha: string; horas: number; coste: number; ventas: number; labor_pct: number | null; splh: number | null }[]
}

export function summarizeLabor(turnos: Turno[], ventas: VentaFranja[]): LaborSummary {
  let horasPlan = 0, horasReal = 0, costeTotal = 0
  const rolMap: Record<string, { horas: number; coste: number }> = {}
  const servicioMap: Record<string, { horas: number; coste: number }> = {}
  const centroMap: Record<string, { horas: number; coste: number }> = {}
  const diaMap: Record<string, { horas: number; coste: number }> = {}

  for (const t of turnos) {
    const h = t.horas_plan != null ? t.horas_plan : netHours(t)
    const hr = t.horas_real != null ? t.horas_real : h
    const c = h * (t.coste_hora || 0)
    horasPlan += h
    horasReal += hr
    costeTotal += c
    const rol = t.rol || '—'
    const serv = t.servicio || 'All day'
    const site = t.site_id || 'DEFAULT'
    rolMap[rol]      = { horas: (rolMap[rol]?.horas      || 0) + h, coste: (rolMap[rol]?.coste      || 0) + c }
    servicioMap[serv]= { horas: (servicioMap[serv]?.horas || 0) + h, coste: (servicioMap[serv]?.coste || 0) + c }
    centroMap[site]  = { horas: (centroMap[site]?.horas   || 0) + h, coste: (centroMap[site]?.coste   || 0) + c }
    diaMap[t.fecha]  = { horas: (diaMap[t.fecha]?.horas   || 0) + h, coste: (diaMap[t.fecha]?.coste   || 0) + c }
  }

  // Ventas agregadas
  let ventasTotales = 0
  const ventasPorDia: Record<string, number> = {}
  const ventasPorSitio: Record<string, number> = {}
  const ventasPorServicio: Record<string, number> = {}

  for (const v of ventas) {
    ventasTotales += v.sales_net
    ventasPorDia[v.fecha]  = (ventasPorDia[v.fecha]  || 0) + v.sales_net
    const site = v.site_id || 'DEFAULT'
    ventasPorSitio[site] = (ventasPorSitio[site] || 0) + v.sales_net
    const serv = serviceForSlot(v.timeslot_start)
    ventasPorServicio[serv] = (ventasPorServicio[serv] || 0) + v.sales_net
  }

  const labor_pct = ventasTotales > 0 ? (costeTotal / ventasTotales) * 100 : null
  const splh = horasPlan > 0 ? ventasTotales / horasPlan : null

  return {
    horas_plan: round1(horasPlan),
    horas_real: round1(horasReal),
    coste_total: round2(costeTotal),
    coste_medio_hora: horasPlan > 0 ? round2(costeTotal / horasPlan) : 0,
    ventas_netas: round2(ventasTotales),
    labor_pct: labor_pct != null ? round1(labor_pct) : null,
    splh: splh != null ? round1(splh) : null,
    por_rol: Object.entries(rolMap)
      .map(([rol, v]) => ({ rol, horas: round1(v.horas), coste: round2(v.coste), pct: costeTotal > 0 ? round1((v.coste / costeTotal) * 100) : 0 }))
      .sort((a, b) => b.coste - a.coste),
    por_servicio: Object.entries(servicioMap)
      .map(([servicio, v]) => {
        const ventasServ = ventasPorServicio[servicio] || 0
        return {
          servicio, horas: round1(v.horas), coste: round2(v.coste), ventas: round2(ventasServ),
          labor_pct: ventasServ > 0 ? round1((v.coste / ventasServ) * 100) : null,
        }
      })
      .sort((a, b) => b.coste - a.coste),
    por_centro: Object.entries(centroMap)
      .map(([site_id, v]) => {
        const ventasCentro = ventasPorSitio[site_id] || 0
        return {
          site_id, horas: round1(v.horas), coste: round2(v.coste), ventas: round2(ventasCentro),
          labor_pct: ventasCentro > 0 ? round1((v.coste / ventasCentro) * 100) : null,
        }
      }),
    por_dia: Object.entries(diaMap)
      .map(([fecha, v]) => {
        const ventasDia = ventasPorDia[fecha] || 0
        return {
          fecha, horas: round1(v.horas), coste: round2(v.coste), ventas: round2(ventasDia),
          labor_pct: ventasDia > 0 ? round1((v.coste / ventasDia) * 100) : null,
          splh: v.horas > 0 ? round1(ventasDia / v.horas) : null,
        }
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
  }
}

// ──────────────────────────────────────────────────────────────
// Productivity
// ──────────────────────────────────────────────────────────────

export interface ProductivitySummary {
  splh: number | null
  ventas_por_empleado: number | null
  tickets_por_hora: number | null
  covers_por_hora: number | null
  productividad_index: number | null   // 0-100 vs target
  prime_cost_pct: number | null
  coste_ineficiencia: number
  por_franja: { slot: string; ventas: number; horas: number; splh: number | null; target_splh: number | null; status: 'ok' | 'warn' | 'crit' }[]
}

export function summarizeProductivity(
  turnos: Turno[],
  ventas: VentaFranja[],
  targets: Target[],
  foodCostEur: number | null = null
): ProductivitySummary {
  let totalHoras = 0, totalCoste = 0, totalVentas = 0, totalTickets = 0, totalCovers = 0
  const empleadosUnicos = new Set<string>()

  for (const t of turnos) {
    const h = t.horas_plan != null ? t.horas_plan : netHours(t)
    totalHoras += h
    totalCoste += h * (t.coste_hora || 0)
    empleadosUnicos.add(`${t.site_id || 'D'}|${t.rol || 'R'}|${t.fecha}|${t.start_time}`)
  }
  for (const v of ventas) {
    totalVentas += v.sales_net
    totalTickets += v.tickets || 0
    totalCovers += v.covers || 0
  }

  const targetSplhDefault = targets.find(t => !t.rol && (!t.servicio || t.servicio === 'All day'))?.target_splh || null

  // Por franja con sus targets y status semáforo
  const porFranja = aggregateByFranja(turnos, ventas, targets, targetSplhDefault)

  // Coste de ineficiencia: suma de (horas plan - horas ideales) * coste medio cuando hay exceso
  let costeInef = 0
  for (const f of porFranja) {
    if (f.target_splh && f.target_splh > 0) {
      const horasIdeales = f.ventas / f.target_splh
      const exceso = Math.max(0, f.horas - horasIdeales)
      const costeMedio = totalHoras > 0 ? totalCoste / totalHoras : 0
      costeInef += exceso * costeMedio
    }
  }

  const splh = totalHoras > 0 ? totalVentas / totalHoras : null
  const productividadIdx = (splh != null && targetSplhDefault && targetSplhDefault > 0)
    ? Math.min(100, Math.round((splh / targetSplhDefault) * 100))
    : null

  return {
    splh: splh != null ? round1(splh) : null,
    ventas_por_empleado: empleadosUnicos.size > 0 ? round2(totalVentas / empleadosUnicos.size) : null,
    tickets_por_hora: totalHoras > 0 && totalTickets > 0 ? round1(totalTickets / totalHoras) : null,
    covers_por_hora: totalHoras > 0 && totalCovers > 0 ? round1(totalCovers / totalHoras) : null,
    productividad_index: productividadIdx,
    prime_cost_pct: (foodCostEur != null && totalVentas > 0) ? round1(((foodCostEur + totalCoste) / totalVentas) * 100) : null,
    coste_ineficiencia: round2(costeInef),
    por_franja: porFranja,
  }
}

function aggregateByFranja(turnos: Turno[], ventas: VentaFranja[], targets: Target[], defaultTargetSplh: number | null) {
  const slotMap: Record<string, { ventas: number; horas: number; servicio: string }> = {}

  for (const v of ventas) {
    const slot = `${v.timeslot_start}–${v.timeslot_end}`
    const serv = serviceForSlot(v.timeslot_start)
    if (!slotMap[slot]) slotMap[slot] = { ventas: 0, horas: 0, servicio: serv }
    slotMap[slot].ventas += v.sales_net
  }

  // Horas por franja: prorratear turnos a slots según solape
  for (const t of turnos) {
    const tStart = parseHM(t.start_time)
    const overnight = parseHM(t.end_time) <= tStart
    const tEnd = overnight ? parseHM(t.end_time) + 24 * 60 : parseHM(t.end_time)
    const totalMins = tEnd - tStart - (t.break_minutes || 0)
    if (totalMins <= 0) continue

    for (const slot of Object.keys(slotMap)) {
      const [s, e] = slot.split('–')
      const sStart = parseHM(s)
      const sEnd = parseHM(e) <= sStart ? parseHM(e) + 24 * 60 : parseHM(e)
      const overlap = Math.max(0, Math.min(tEnd, sEnd) - Math.max(tStart, sStart))
      if (overlap > 0) {
        const fracOfTurno = overlap / (tEnd - tStart)
        const horasFranja = (totalMins / 60) * fracOfTurno
        slotMap[slot].horas += horasFranja
      }
    }
  }

  return Object.entries(slotMap).map(([slot, data]) => {
    const slotStartHm = slot.split('–')[0]
    const targetForServ = targets.find(t => t.servicio && t.servicio === data.servicio)?.target_splh
    const target_splh = targetForServ || defaultTargetSplh
    const splh = data.horas > 0 ? data.ventas / data.horas : null
    let status: 'ok' | 'warn' | 'crit' = 'ok'
    if (target_splh && splh != null) {
      const ratio = splh / target_splh
      if (ratio < 0.6) status = 'crit'
      else if (ratio < 0.85) status = 'warn'
    }
    return {
      slot,
      ventas: round2(data.ventas),
      horas: round1(data.horas),
      splh: splh != null ? round1(splh) : null,
      target_splh: target_splh ?? null,
      status,
    }
  }).sort((a, b) => a.slot.localeCompare(b.slot))
}

// ──────────────────────────────────────────────────────────────
// Turno Ideal
// ──────────────────────────────────────────────────────────────

export interface IdealShiftSlot {
  slot: string                   // HH:MM–HH:MM
  servicio: string
  ventas_previstas: number
  target_splh: number
  horas_ideales: number
  coste_ideal: number
  horas_plan: number
  coste_plan: number
  delta_horas: number            // plan - ideal (positivo = sobredotación)
  delta_coste: number
  status: 'sobredotacion' | 'subdotacion' | 'ok'
  recomendacion: string
}

export interface TurnoIdealInput {
  forecast: { slot: string; ventas: number; servicio?: string }[]   // ventas_previstas por slot
  target_splh: number              // global o por servicio
  targets_por_servicio?: Record<string, number>   // override
  coste_medio_hora: number
  plan?: { slot: string; horas: number }[]        // horas planificadas por slot (opcional)
}

export function calcTurnoIdeal(input: TurnoIdealInput): IdealShiftSlot[] {
  const planMap: Record<string, number> = {}
  for (const p of input.plan || []) planMap[p.slot] = p.horas

  return input.forecast.map(f => {
    const servicio = f.servicio || serviceForSlot(f.slot.split('–')[0])
    const target = input.targets_por_servicio?.[servicio] || input.target_splh
    const horas_ideales = target > 0 ? f.ventas / target : 0
    const coste_ideal = horas_ideales * input.coste_medio_hora
    const horas_plan = planMap[f.slot] || 0
    const coste_plan = horas_plan * input.coste_medio_hora
    const delta_horas = horas_plan - horas_ideales
    const delta_coste = coste_plan - coste_ideal

    // Semántica clara (feedback): H Plan vs H Ideal.
    //   H Plan = 0 y se necesitan horas        → falta cobertura (subdotación), NUNCA OK
    //   H Plan < H Ideal (margen >0.5h)         → falta cobertura / reforzar
    //   H Plan > H Ideal (margen >1h)           → exceso / sobreplantilla
    //   resto                                   → cobertura correcta
    let status: IdealShiftSlot['status'] = 'ok'
    let recomendacion = `Cobertura correcta para ${servicio.toLowerCase()}`
    if (horas_ideales <= 0.01) {
      // No se prevén ventas → no hace falta plantilla
      if (horas_plan > 0.5) {
        status = 'sobredotacion'
        recomendacion = `Sin ventas previstas: reduce ${round1(horas_plan)}h en ${f.slot} · ahorra ${round2(coste_plan)}€`
      } else {
        recomendacion = 'Sin actividad prevista en esta franja'
      }
    } else if (horas_plan <= 0.01) {
      // Hace falta plantilla pero no hay ninguna planificada → falta cobertura
      status = 'subdotacion'
      recomendacion = `Sin plantilla: planifica ${round1(horas_ideales)}h en ${f.slot}`
    } else if (delta_horas > 1) {
      status = 'sobredotacion'
      recomendacion = `Exceso de plantilla: reduce ${round1(delta_horas)}h en ${f.slot} · ahorra ${round2(delta_coste)}€`
    } else if (delta_horas < -0.5) {
      status = 'subdotacion'
      recomendacion = `Falta cobertura: refuerza ${round1(Math.abs(delta_horas))}h en ${f.slot}`
    }

    return {
      slot: f.slot,
      servicio,
      ventas_previstas: round2(f.ventas),
      target_splh: target,
      horas_ideales: round1(horas_ideales),
      coste_ideal: round2(coste_ideal),
      horas_plan: round1(horas_plan),
      coste_plan: round2(coste_plan),
      delta_horas: round1(delta_horas),
      delta_coste: round2(delta_coste),
      status,
      recomendacion,
    }
  })
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

export function serviceForSlot(hm: string): string {
  const mins = parseHM(hm)
  if (mins < 11 * 60) return 'Desayuno'
  if (mins < 16 * 60) return 'Comida'
  if (mins < 19 * 60) return 'Entre servicios'
  return 'Cena'
}

function round1(n: number): number { return Math.round(n * 10) / 10 }
function round2(n: number): number { return Math.round(n * 100) / 100 }
