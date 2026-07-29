import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { netHours, parseHM } from '@/lib/laborMath'

export const dynamic = 'force-dynamic'

interface ImportPayload {
  type: 'turnos' | 'ventas_franja'
  rows: Record<string, string>[]
  mapping: Record<string, string>          // {csv_col: db_field}
}

// CSV-able fields per type
const FIELDS_TURNOS = ['site_id', 'date', 'employee_id', 'employee_name', 'role', 'area', 'start_time', 'end_time', 'break_minutes', 'hourly_cost', 'contract_hours_week', 'source']
const FIELDS_VENTAS = ['site_id', 'date', 'timeslot_start', 'timeslot_end', 'channel', 'sales_net', 'covers', 'orders', 'tickets', 'source']

// Parsea números tolerando formato europeo: "1.450,80" → 1450.80, "11,50" → 11.5
function numEU(v: string | undefined | null): number | null {
  if (v == null) return null
  let s = String(v).trim().replace(/[€\s]/g, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) {
    // el último separador es el decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}
function intEU(v: string | undefined | null): number | null {
  const n = numEU(v)
  return n == null ? null : Math.round(n)
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { type, rows, mapping } = await req.json() as ImportPayload
  if (!type || !rows?.length) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  let inserted = 0
  const errors: { row: number; reason: string }[] = []
  // LC-01: trazabilidad del vínculo turno↔empleado
  let vinculados = 0
  const sinVincular = new Set<string>()

  // Snapshot empleados para mapear nombre→id+coste
  const empleados = db.prepare('SELECT id, nombre, employee_id, coste_hora, rol FROM empleados WHERE user_id=?').all(user.id) as any[]
  const empByName: Record<string, any> = {}
  const empByExtId: Record<string, any> = {}
  for (const e of empleados) {
    if (e.nombre) empByName[e.nombre.toLowerCase().trim()] = e
    if (e.employee_id) empByExtId[e.employee_id] = e
  }

  const insertTurno = db.prepare(`
    INSERT INTO turnos (user_id, site_id, employee_id, employee_name, rol, servicio, fecha, start_time, end_time, break_minutes, horas_plan, coste_hora, source, overnight)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertVenta = db.prepare(`
    INSERT INTO ventas_franja (user_id, site_id, fecha, timeslot_start, timeslot_end, channel, sales_net, covers, orders, tickets, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const tx = db.transaction(() => {
    rows.forEach((rawRow, idx) => {
      const row: Record<string, string> = {}
      // Apply mapping
      for (const [csvCol, dbField] of Object.entries(mapping)) {
        if (dbField && dbField !== '__skip__') row[dbField] = (rawRow[csvCol] || '').trim()
      }
      try {
        if (type === 'turnos') {
          if (!row.date || !row.start_time || !row.end_time) {
            const faltan = [!row.date && 'fecha', !row.start_time && 'hora de inicio', !row.end_time && 'hora de fin'].filter(Boolean).join(', ')
            errors.push({ row: idx + 1, reason: `Faltan campos obligatorios: ${faltan}` })
            return
          }
          const ext = row.employee_id ? empByExtId[row.employee_id] : null
          const byName = row.employee_name ? empByName[row.employee_name.toLowerCase().trim()] : null
          const emp = ext || byName
          // LC-01: si el turno trae persona pero no casa con el maestro, queda "sin vincular"
          if (emp) vinculados++
          else if (row.employee_name || row.employee_id) sinVincular.add(row.employee_name || row.employee_id)
          const costeHora = numEU(row.hourly_cost) ?? (emp?.coste_hora || null)
          const overnight = parseHM(row.end_time) <= parseHM(row.start_time) ? 1 : 0
          const horasPlan = netHours({
            fecha: row.date, start_time: row.start_time, end_time: row.end_time,
            break_minutes: intEU(row.break_minutes) ?? 0,
            coste_hora: costeHora, rol: row.role || null, site_id: row.site_id || null,
          })
          insertTurno.run(
            user.id,
            row.site_id || null,
            emp?.id || null,
            row.employee_name || emp?.nombre || null,
            row.role || emp?.rol || null,
            row.area || null,
            row.date,
            row.start_time,
            row.end_time,
            intEU(row.break_minutes) ?? 0,
            horasPlan,
            costeHora,
            row.source || 'csv',
            overnight,
          )
          inserted++
        } else if (type === 'ventas_franja') {
          if (!row.date || !row.timeslot_start || !row.timeslot_end) {
            const faltan = [!row.date && 'fecha', !row.timeslot_start && 'inicio de franja', !row.timeslot_end && 'fin de franja'].filter(Boolean).join(', ')
            errors.push({ row: idx + 1, reason: `Faltan campos obligatorios: ${faltan}` })
            return
          }
          insertVenta.run(
            user.id,
            row.site_id || null,
            row.date,
            row.timeslot_start,
            row.timeslot_end,
            row.channel || 'Sala',
            numEU(row.sales_net) ?? 0,
            intEU(row.covers),
            intEU(row.orders),
            intEU(row.tickets),
            row.source || 'csv',
          )
          inserted++
        }
      } catch (e: any) {
        errors.push({ row: idx + 1, reason: e.message })
      }
    })
  })
  tx()

  return NextResponse.json({
    inserted, errors, total: rows.length,
    available_fields: type === 'turnos' ? FIELDS_TURNOS : FIELDS_VENTAS,
    // LC-01: reporte de vínculo con el maestro de empleados (solo turnos)
    ...(type === 'turnos' ? {
      vinculo: {
        vinculados,
        sin_vincular: sinVincular.size,
        nombres_sin_vincular: Array.from(sinVincular).slice(0, 20),
      },
    } : {}),
  })
}
