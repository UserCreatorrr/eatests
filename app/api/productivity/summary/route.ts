import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { summarizeProductivity, Turno, VentaFranja, Target } from '@/lib/laborMath'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const from = url.searchParams.get('from') || sevenDaysAgo()
  const to = url.searchParams.get('to') || new Date().toISOString().split('T')[0]
  const site = url.searchParams.get('site')

  const turnos = db.prepare(`
    SELECT fecha, start_time, end_time, break_minutes, coste_hora, rol, site_id, servicio, horas_plan, horas_real
    FROM turnos
    WHERE user_id=? AND fecha BETWEEN ? AND ?
    ${site ? 'AND site_id=?' : ''}
  `).all(...(site ? [user.id, from, to, site] : [user.id, from, to])) as Turno[]

  const ventas = db.prepare(`
    SELECT fecha, timeslot_start, timeslot_end, sales_net, covers, orders, tickets, channel, site_id
    FROM ventas_franja
    WHERE user_id=? AND fecha BETWEEN ? AND ?
    ${site ? 'AND site_id=?' : ''}
  `).all(...(site ? [user.id, from, to, site] : [user.id, from, to])) as VentaFranja[]

  const targets = db.prepare(`
    SELECT servicio, rol, target_labor_pct, target_splh, min_staff_role, max_staff_role
    FROM targets_productividad
    WHERE user_id=?
    ${site ? 'AND (site_id=? OR site_id IS NULL)' : ''}
  `).all(...(site ? [user.id, site] : [user.id])) as Target[]

  // Food cost del periodo si está disponible
  const fcRow = db.prepare(`
    SELECT ROUND(SUM(total),2) as t FROM facturas_compra
    WHERE user_id=? AND date(date_invoice) BETWEEN ? AND ?
  `).get(user.id, from, to) as any
  const foodCostEur = fcRow?.t || null

  const summary = summarizeProductivity(turnos, ventas, targets, foodCostEur)

  // Sin fichajes, el motor cae a horas PLANIFICADAS. Se declara la procedencia
  // para que la interfaz no llame "hora trabajada" a una hora planificada.
  const conReal = turnos.filter((t: any) => t.horas_real != null).length
  const fuente_horas = turnos.length === 0 ? 'sin_datos'
    : conReal === 0 ? 'plan'
    : conReal === turnos.length ? 'real'
    : 'mixta'

  return NextResponse.json({ summary, from, to, site, fuente_horas, turnos_con_fichaje: conReal, turnos_total: turnos.length })
}

function sevenDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}
