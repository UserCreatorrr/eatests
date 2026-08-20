import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { summarizeLabor, summarizeProductivity, Turno, VentaFranja, Target } from '@/lib/laborMath'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const scope = (url.searchParams.get('scope') || 'grupo') as 'grupo' | 'local'
  const siteId = url.searchParams.get('site') || null
  const fecha = url.searchParams.get('fecha') || new Date().toISOString().split('T')[0]
  const ayer = new Date(fecha); ayer.setDate(ayer.getDate() - 1)
  const ayerStr = ayer.toISOString().split('T')[0]

  const userId = user.id
  const where_site = scope === 'local' && siteId ? 'AND site_id=?' : ''
  const siteParams = scope === 'local' && siteId ? [siteId] : []

  // ── VENTAS (ayer + forecast hoy)
  const ventasAyer = db.prepare(`SELECT ROUND(SUM(sales_net),2) as t FROM ventas_franja WHERE user_id=? AND fecha=? ${where_site}`).get(userId, ayerStr, ...siteParams) as any
  const ventasHoy = db.prepare(`SELECT ROUND(SUM(sales_net),2) as t FROM ventas_franja WHERE user_id=? AND fecha=? ${where_site}`).get(userId, fecha, ...siteParams) as any
  const ventas_ayer = ventasAyer?.t || 0
  const ventas_hoy_forecast = ventasHoy?.t || 0

  // ── LABOR
  const turnosAyer = db.prepare(`
    SELECT fecha, start_time, end_time, break_minutes, coste_hora, rol, site_id, servicio, horas_plan, horas_real
    FROM turnos WHERE user_id=? AND fecha=? ${where_site}
  `).all(userId, ayerStr, ...siteParams) as Turno[]
  const ventasFranjaAyer = db.prepare(`
    SELECT fecha, timeslot_start, timeslot_end, sales_net, covers, orders, tickets, channel, site_id
    FROM ventas_franja WHERE user_id=? AND fecha=? ${where_site}
  `).all(userId, ayerStr, ...siteParams) as VentaFranja[]
  const targets = db.prepare(`SELECT * FROM targets_productividad WHERE user_id=?`).all(userId) as Target[]

  const laborSum = summarizeLabor(turnosAyer, ventasFranjaAyer)
  const prodSum = summarizeProductivity(turnosAyer, ventasFranjaAyer, targets, null)

  // ── FOOD COST (FC% teórico simplificado: gasto / ventas del periodo)
  const fcRow = db.prepare(`
    SELECT ROUND(SUM(total),2) as t FROM facturas_compra
    WHERE user_id=? AND date(date_invoice) BETWEEN date(?,'-7 days') AND ?
  `).get(userId, fecha, fecha) as any
  const fc7d = fcRow?.t || 0
  const ventasUlt7 = db.prepare(`
    SELECT ROUND(SUM(sales_net),2) as t FROM ventas_franja
    WHERE user_id=? AND fecha BETWEEN date(?,'-7 days') AND ? ${where_site}
  `).get(userId, fecha, fecha, ...siteParams) as any
  // Contrato de "sin datos": hace falta gasto Y ventas. Con uno de los dos a cero
  // el porcentaje no significa nada, así que se devuelve null y la UI pinta "—".
  const fc_pct = (ventasUlt7?.t > 0 && fc7d > 0) ? Math.round((fc7d / ventasUlt7.t) * 100) : null

  // ── MERMA AYER
  const mermaRow = db.prepare(`
    SELECT ROUND(SUM(coste_estimado),2) as t, COUNT(*) as n FROM merma_registro
    WHERE user_id=? AND date(fecha)=?
  `).get(userId, ayerStr) as any
  const topMerma = db.prepare(`
    SELECT nombre, ROUND(SUM(coste_estimado),2) as t FROM merma_registro
    WHERE user_id=? AND date(fecha)=?
    GROUP BY nombre ORDER BY t DESC LIMIT 3
  `).all(userId, ayerStr) as any[]

  // ── CASH / PAGOS
  const facVencidasRow = db.prepare(`
    SELECT COUNT(*) as c, ROUND(SUM(total),2) as t FROM facturas_compra
    WHERE user_id=? AND (paid=0 OR paid IS NULL) AND date_due < date(?)
  `).get(userId, fecha) as any
  const facProx7Row = db.prepare(`
    SELECT COUNT(*) as c, ROUND(SUM(total),2) as t FROM facturas_compra
    WHERE user_id=? AND (paid=0 OR paid IS NULL) AND date_due BETWEEN date(?) AND date(?,'+7 days')
  `).get(userId, fecha, fecha) as any

  // ── TOP 5 ALERTAS
  const alertas: { titulo: string; impacto: string; link: string; urgencia: 'crit' | 'warn' | 'info' }[] = []
  if (facVencidasRow?.c > 0) {
    alertas.push({
      titulo: `${facVencidasRow.c} facturas vencidas`,
      impacto: `${facVencidasRow.t || 0}€ sin pagar`,
      link: '/dashboard/compras/facturas',
      urgencia: 'crit',
    })
  }
  if (laborSum.labor_pct != null && laborSum.labor_pct > 30) {
    alertas.push({
      titulo: 'Labor cost por encima del 30%',
      impacto: `${laborSum.labor_pct}% en el día de ayer`,
      link: '/dashboard/labor',
      urgencia: 'crit',
    })
  }
  if (prodSum.coste_ineficiencia > 100) {
    alertas.push({
      titulo: 'Coste de ineficiencia laboral elevado',
      impacto: `${prodSum.coste_ineficiencia}€ en horas no rentables`,
      link: '/dashboard/productivity',
      urgencia: 'warn',
    })
  }
  if (fc_pct != null && fc_pct > 33) {
    alertas.push({
      titulo: 'Food cost por encima del 33%',
      impacto: `${fc_pct}% últimos 7 días`,
      link: '/dashboard/sangrado',
      urgencia: 'crit',
    })
  }
  if (mermaRow?.t > 50) {
    alertas.push({
      titulo: 'Merma diaria elevada',
      impacto: `${mermaRow.t}€ en ${mermaRow.n} eventos`,
      link: '/dashboard/sangrado',
      urgencia: 'warn',
    })
  }
  if (facProx7Row?.c > 0) {
    alertas.push({
      titulo: `${facProx7Row.c} facturas vencen en 7 días`,
      impacto: `${facProx7Row.t || 0}€`,
      link: '/dashboard/compras/facturas',
      urgencia: 'info',
    })
  }
  const top5 = alertas.slice(0, 5)

  // ── 3 PRIORIDADES del día
  const prioridades: string[] = []
  if (facVencidasRow?.c > 0) prioridades.push(`Pagar ${facVencidasRow.c} facturas vencidas (${facVencidasRow.t}€)`)
  if (prodSum.por_franja.some(f => f.status === 'crit')) {
    const peor = prodSum.por_franja.find(f => f.status === 'crit')
    prioridades.push(`Revisar plantilla en franja ${peor?.slot} (SPLH crítico)`)
  }
  if (mermaRow?.n > 0) prioridades.push(`Analizar merma de ayer (${mermaRow.n} eventos, ${mermaRow.t || 0}€)`)
  if (fc_pct != null && fc_pct > 30) prioridades.push(`Revisar escandallo: FC% en ${fc_pct}%`)
  // Antes se rellenaba hasta 3 repitiendo la misma frase, y el brief mostraba
  // tres prioridades idénticas. Ahora se muestran solo las reales (máximo 3) y,
  // si no hay ninguna, se dice explícitamente que no hay acciones pendientes.
  const prioridadesUnicas = Array.from(new Set(prioridades)).slice(0, 3)

  // ── DATA QUALITY
  const hasVentas = ventasFranjaAyer.length > 0
  const hasTurnos = turnosAyer.length > 0
  const hasFC = fc7d > 0
  const data_quality = hasVentas && hasTurnos && hasFC ? 'OK' : 'PARCIAL'

  // Lista concreta de qué falta y dónde cargarlo (para el banner del brief)
  const missing: { dato: string; detalle: string; link: string }[] = []
  if (!hasVentas) missing.push({ dato: 'Ventas por franja (ayer)', detalle: 'Sin ventas → forecast, SPLH y productividad salen como —', link: '/dashboard/labor/turnos' })
  if (!hasTurnos) missing.push({ dato: 'Turnos plan (ayer)', detalle: 'Sin turnos → Labor Cost y horas plan salen como —', link: '/dashboard/labor/turnos' })
  if (!hasFC) missing.push({ dato: 'Compras / escandallos (7d)', detalle: 'Sin gasto de compras → Food Cost% sale como —', link: '/dashboard/compras/facturas' })

  const payload = {
    scope, site_id: siteId, fecha,
    generado: new Date().toISOString(),
    data_quality,
    missing,
    kpis: {
      ventas: { ayer: ventas_ayer, hoy_forecast: ventas_hoy_forecast },
      food_cost: { pct: fc_pct, gasto_7d: fc7d, ventas_7d: ventasUlt7?.t || 0 },
      labor: { pct: laborSum.labor_pct, coste: laborSum.coste_total, horas_plan: laborSum.horas_plan },
      productivity: { splh: prodSum.splh, productividad_index: prodSum.productividad_index, coste_ineficiencia: prodSum.coste_ineficiencia, tickets_por_hora: prodSum.tickets_por_hora },
      merma: { total: mermaRow?.t || 0, eventos: mermaRow?.n || 0, top: topMerma },
      cash: { vencidas: facVencidasRow, proximas_7d: facProx7Row },
    },
    alertas: top5,
    prioridades: prioridadesUnicas,
    sin_prioridades: prioridadesUnicas.length === 0,
  }

  // Guardar histórico — un único registro por (scope, site, fecha). Si ya existe, se actualiza.
  const existing = db.prepare(
    `SELECT id FROM reports_briefs WHERE user_id=? AND scope=? AND fecha=? AND (site_id IS ? OR site_id = ?) LIMIT 1`
  ).get(userId, scope, fecha, siteId, siteId) as any
  if (existing) {
    db.prepare(`UPDATE reports_briefs SET payload=?, data_quality=?, created_at=datetime('now') WHERE id=?`)
      .run(JSON.stringify(payload), data_quality, existing.id)
  } else {
    db.prepare(`INSERT INTO reports_briefs (user_id, scope, site_id, fecha, payload, data_quality) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(userId, scope, siteId, fecha, JSON.stringify(payload), data_quality)
  }

  return NextResponse.json(payload)
}
