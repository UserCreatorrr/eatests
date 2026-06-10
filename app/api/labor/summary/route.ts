import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { summarizeLabor, Turno, VentaFranja } from '@/lib/laborMath'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const from = url.searchParams.get('from') || sevenDaysAgo()
  const to = url.searchParams.get('to') || new Date().toISOString().split('T')[0]
  const site = url.searchParams.get('site')

  const turnosRaw = db.prepare(`
    SELECT fecha, start_time, end_time, break_minutes, coste_hora, rol, site_id, servicio, horas_plan, horas_real
    FROM turnos
    WHERE user_id=? AND fecha BETWEEN ? AND ?
    ${site ? 'AND site_id=?' : ''}
  `).all(...(site ? [user.id, from, to, site] : [user.id, from, to])) as any[]

  const ventasRaw = db.prepare(`
    SELECT fecha, timeslot_start, timeslot_end, sales_net, covers, orders, tickets, channel, site_id
    FROM ventas_franja
    WHERE user_id=? AND fecha BETWEEN ? AND ?
    ${site ? 'AND site_id=?' : ''}
  `).all(...(site ? [user.id, from, to, site] : [user.id, from, to])) as any[]

  const turnos: Turno[] = turnosRaw.map((t: any) => ({
    fecha: t.fecha, start_time: t.start_time, end_time: t.end_time,
    break_minutes: t.break_minutes || 0,
    coste_hora: t.coste_hora,
    rol: t.rol, site_id: t.site_id, servicio: t.servicio,
    horas_plan: t.horas_plan, horas_real: t.horas_real,
  }))

  const ventas: VentaFranja[] = ventasRaw.map((v: any) => ({
    fecha: v.fecha,
    timeslot_start: v.timeslot_start, timeslot_end: v.timeslot_end,
    sales_net: v.sales_net || 0,
    covers: v.covers, orders: v.orders, tickets: v.tickets,
    channel: v.channel, site_id: v.site_id,
  }))

  const summary = summarizeLabor(turnos, ventas)

  // Data quality
  const dq = {
    has_turnos: turnos.length > 0,
    has_ventas: ventas.length > 0,
    has_coste_hora: turnos.every(t => t.coste_hora != null),
    data_quality: turnos.length > 0 && ventas.length > 0 ? 'OK' : 'PARCIAL',
  }

  return NextResponse.json({ summary, dq, from, to, site })
}

function sevenDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}
