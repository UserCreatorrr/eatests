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

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { type, rows, mapping } = await req.json() as ImportPayload
  if (!type || !rows?.length) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  let inserted = 0
  const errors: { row: number; reason: string }[] = []

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
            errors.push({ row: idx + 1, reason: 'Faltan date/start_time/end_time' })
            return
          }
          const ext = row.employee_id ? empByExtId[row.employee_id] : null
          const byName = row.employee_name ? empByName[row.employee_name.toLowerCase().trim()] : null
          const emp = ext || byName
          const costeHora = row.hourly_cost ? parseFloat(row.hourly_cost) : (emp?.coste_hora || null)
          const overnight = parseHM(row.end_time) <= parseHM(row.start_time) ? 1 : 0
          const horasPlan = netHours({
            fecha: row.date, start_time: row.start_time, end_time: row.end_time,
            break_minutes: row.break_minutes ? parseInt(row.break_minutes) : 0,
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
            row.break_minutes ? parseInt(row.break_minutes) : 0,
            horasPlan,
            costeHora,
            row.source || 'csv',
            overnight,
          )
          inserted++
        } else if (type === 'ventas_franja') {
          if (!row.date || !row.timeslot_start || !row.timeslot_end) {
            errors.push({ row: idx + 1, reason: 'Faltan date/timeslot_start/timeslot_end' })
            return
          }
          insertVenta.run(
            user.id,
            row.site_id || null,
            row.date,
            row.timeslot_start,
            row.timeslot_end,
            row.channel || 'Sala',
            row.sales_net ? parseFloat(row.sales_net) : 0,
            row.covers ? parseInt(row.covers) : null,
            row.orders ? parseInt(row.orders) : null,
            row.tickets ? parseInt(row.tickets) : null,
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

  return NextResponse.json({ inserted, errors, total: rows.length, available_fields: type === 'turnos' ? FIELDS_TURNOS : FIELDS_VENTAS })
}
