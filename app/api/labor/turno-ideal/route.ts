import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { calcTurnoIdeal, TurnoIdealInput, netHours } from '@/lib/laborMath'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as Partial<TurnoIdealInput> & { fecha?: string; site_id?: string }
  if (!body.forecast || !body.target_splh) {
    return NextResponse.json({ error: 'forecast y target_splh son obligatorios' }, { status: 400 })
  }

  // Si no se pasa coste_medio_hora, intentar derivarlo de empleados activos
  let costeMedioHora: number = body.coste_medio_hora ?? 0
  if (!costeMedioHora) {
    const r = db.prepare('SELECT AVG(coste_hora) as avg FROM empleados WHERE user_id=? AND activo=1 AND coste_hora>0').get(user.id) as any
    costeMedioHora = r?.avg || 12  // fallback razonable
  }

  // Si no se pasa plan, intentar reconstruirlo de turnos del día
  let plan = body.plan || []
  if (plan.length === 0 && body.fecha) {
    const turnos = db.prepare(`
      SELECT start_time, end_time, break_minutes, horas_plan FROM turnos
      WHERE user_id=? AND fecha=?
      ${body.site_id ? 'AND site_id=?' : ''}
    `).all(...(body.site_id ? [user.id, body.fecha, body.site_id] : [user.id, body.fecha])) as any[]

    // Asignar cada turno al slot de forecast en el que más solapa
    plan = body.forecast.map(f => {
      const [s, e] = f.slot.split('–')
      const sMin = parseHM(s); const eMin = parseHM(e) <= sMin ? parseHM(e) + 1440 : parseHM(e)
      let totalHoras = 0
      for (const t of turnos) {
        const tStart = parseHM(t.start_time)
        const overnight = parseHM(t.end_time) <= tStart
        const tEnd = overnight ? parseHM(t.end_time) + 1440 : parseHM(t.end_time)
        const overlap = Math.max(0, Math.min(tEnd, eMin) - Math.max(tStart, sMin))
        if (overlap > 0) {
          const h = t.horas_plan != null ? t.horas_plan : netHours({
            fecha: '', start_time: t.start_time, end_time: t.end_time,
            break_minutes: t.break_minutes || 0, coste_hora: null, rol: null, site_id: null,
          } as any)
          const fracOfTurno = overlap / (tEnd - tStart)
          totalHoras += h * fracOfTurno
        }
      }
      return { slot: f.slot, horas: totalHoras }
    })
  }

  const result = calcTurnoIdeal({
    forecast: body.forecast,
    target_splh: body.target_splh,
    targets_por_servicio: body.targets_por_servicio,
    coste_medio_hora: costeMedioHora,
    plan,
  })

  const totales = result.reduce((acc, s) => ({
    horas_ideales: acc.horas_ideales + s.horas_ideales,
    coste_ideal:   acc.coste_ideal   + s.coste_ideal,
    horas_plan:    acc.horas_plan    + s.horas_plan,
    coste_plan:    acc.coste_plan    + s.coste_plan,
    delta_horas:   acc.delta_horas   + s.delta_horas,
    delta_coste:   acc.delta_coste   + s.delta_coste,
    ventas:        acc.ventas        + s.ventas_previstas,
  }), { horas_ideales: 0, coste_ideal: 0, horas_plan: 0, coste_plan: 0, delta_horas: 0, delta_coste: 0, ventas: 0 })

  const alertas = result
    .filter(s => s.status !== 'ok')
    .map(s => ({ slot: s.slot, status: s.status, recomendacion: s.recomendacion }))

  return NextResponse.json({ slots: result, totales, alertas })
}

function parseHM(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
