// Daily brief: una foto del día con ventas, labor, food cost, merma y caja.
// Cada KPI declara si tiene datos; con uno de los dos lados a cero no se
// inventa un porcentaje. Se guarda un registro por (ámbito, centro, fecha).
import { z } from 'zod'
import { addDays, nowIso, parseDate, today } from '@/server/domain/dates'
import { ValidationError } from '@/server/domain/errors'
import { summarizeLabor, summarizeProductivity } from '@/server/domain/labor'
import { fromCents, round2 } from '@/server/domain/money'
import type { Ctx } from '@/server/http/context'
import { listSalesSlots, listShifts, listTargets } from './labor'
import { spendBetween } from './analytics'
import { wasteInPeriod } from './waste'

export const briefQuerySchema = z.object({
  scope: z.enum(['group', 'location']).optional(),
  locationId: z.coerce.number().int().positive().optional(),
  date: z.string().optional(),
})

export interface BriefAlert { titulo: string; impacto: string; link: string; urgencia: 'crit' | 'warn' | 'info' }

export function dailyBrief(ctx: Ctx, q: z.infer<typeof briefQuerySchema> = {}) {
  const date = q.date ? parseDate(q.date) : today()
  if (!date) throw new ValidationError('Fecha no válida')
  const scope = q.scope ?? (q.locationId ? 'location' : 'group')
  const locationId = scope === 'location' ? q.locationId ?? null : null
  if (scope === 'location' && !locationId) throw new ValidationError('Indica el centro para un brief por local')
  const yesterday = addDays(date, -1), weekAgo = addDays(date, -7)
  const o = ctx.orgId

  const salesY = listSalesSlots(ctx, { from: yesterday, to: yesterday, locationId })
  const salesT = listSalesSlots(ctx, { from: date, to: date, locationId })
  const sum = (xs: { net_sales: number }[]) => round2(xs.reduce((s, x) => s + x.net_sales, 0))
  const shiftsY = listShifts(ctx, { from: yesterday, to: yesterday, locationId })
  const labor = summarizeLabor(shiftsY, salesY)
  const prod = summarizeProductivity(shiftsY, salesY, listTargets(ctx, locationId), null)

  const spend7 = spendBetween(ctx, weekAgo, date)
  const sales7 = sum(listSalesSlots(ctx, { from: weekAgo, to: date, locationId }))
  const fcPct = spend7 > 0 && sales7 > 0 ? Math.round((spend7 / sales7) * 100) : null

  const waste = wasteInPeriod(ctx, yesterday, yesterday)
  const topWaste = ctx.db.prepare('SELECT description, ROUND(SUM(COALESCE(estimated_cost, 0)), 2) AS cost FROM waste_records WHERE org_id = ? AND occurred_on = ? GROUP BY description ORDER BY cost DESC LIMIT 3').all(o, yesterday)

  const overdue = ctx.db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(total_cents), 0) AS t FROM invoices WHERE org_id = ? AND status = 'pending' AND due_date < ?`).get(o, date) as any
  const next7 = ctx.db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(total_cents), 0) AS t FROM invoices WHERE org_id = ? AND status = 'pending' AND due_date BETWEEN ? AND ?`).get(o, date, addDays(date, 7)) as any

  const alertas: BriefAlert[] = []
  if (overdue.c > 0) alertas.push({ titulo: `${overdue.c} facturas vencidas`, impacto: `${fromCents(overdue.t)}€ sin pagar`, link: '/dashboard/compras/facturas', urgencia: 'crit' })
  if (labor.labor_pct != null && labor.labor_pct > 30) alertas.push({ titulo: 'Labor cost por encima del 30%', impacto: `${labor.labor_pct}% en el día de ayer`, link: '/dashboard/labor', urgencia: 'crit' })
  if (prod.coste_ineficiencia != null && prod.coste_ineficiencia > 100) alertas.push({ titulo: 'Coste de ineficiencia laboral elevado', impacto: `${prod.coste_ineficiencia}€ en horas no rentables`, link: '/dashboard/productivity', urgencia: 'warn' })
  if (fcPct != null && fcPct > 33) alertas.push({ titulo: 'Food cost por encima del 33%', impacto: `${fcPct}% últimos 7 días`, link: '/dashboard/sangrado', urgencia: 'crit' })
  if (waste.cost > 50) alertas.push({ titulo: 'Merma diaria elevada', impacto: `${waste.cost}€ en ${waste.n} eventos`, link: '/dashboard/merma', urgencia: 'warn' })
  if (next7.c > 0) alertas.push({ titulo: `${next7.c} facturas vencen en 7 días`, impacto: `${fromCents(next7.t)}€`, link: '/dashboard/compras/facturas', urgencia: 'info' })

  const prioridades: string[] = []
  if (overdue.c > 0) prioridades.push(`Pagar ${overdue.c} facturas vencidas (${fromCents(overdue.t)}€)`)
  const peor = prod.por_franja.find(f => f.status === 'crit')
  if (peor) prioridades.push(`Revisar plantilla en franja ${peor.slot} (SPLH crítico)`)
  if (waste.n > 0) prioridades.push(`Analizar merma de ayer (${waste.n} eventos, ${waste.cost}€)`)
  if (fcPct != null && fcPct > 30) prioridades.push(`Revisar escandallo: FC% en ${fcPct}%`)

  const missing: { dato: string; detalle: string; link: string }[] = []
  if (salesY.length === 0) missing.push({ dato: 'Ventas por franja (ayer)', detalle: 'Sin ventas no hay forecast, SPLH ni productividad', link: '/dashboard/labor/turnos' })
  if (shiftsY.length === 0) missing.push({ dato: 'Turnos (ayer)', detalle: 'Sin turnos no hay labor cost ni horas plan', link: '/dashboard/labor/turnos' })
  if (spend7 === 0) missing.push({ dato: 'Compras (7 días)', detalle: 'Sin facturas de compra no hay food cost', link: '/dashboard/compras/facturas' })
  const data_quality = missing.length === 0 ? 'OK' : 'PARCIAL'

  const payload = {
    scope, locationId, date, generado: nowIso(), data_quality, missing,
    kpis: {
      ventas: { ayer: sum(salesY), hoy_forecast: sum(salesT) },
      food_cost: { pct: fcPct, gasto_7d: spend7, ventas_7d: sales7 },
      labor: { pct: labor.labor_pct, coste: labor.coste_total, horas_plan: labor.horas_plan },
      productivity: { splh: prod.splh, productividad_index: prod.productividad_index, coste_ineficiencia: prod.coste_ineficiencia, tickets_por_hora: prod.tickets_por_hora },
      merma: { total: waste.cost, eventos: waste.n, top: topWaste },
      cash: { vencidas: { n: overdue.c, total: fromCents(overdue.t) }, proximas_7d: { n: next7.c, total: fromCents(next7.t) } },
    },
    alertas: alertas.slice(0, 5),
    prioridades: Array.from(new Set(prioridades)).slice(0, 3),
  }

  const existing = ctx.db.prepare('SELECT id FROM report_briefs WHERE org_id = ? AND scope = ? AND brief_date = ? AND location_id IS ?').get(o, scope, date, locationId) as { id: number } | undefined
  if (existing) ctx.db.prepare('UPDATE report_briefs SET payload_json = ?, data_quality = ?, created_at = ? WHERE id = ?').run(JSON.stringify(payload), data_quality, nowIso(), existing.id)
  else ctx.db.prepare('INSERT INTO report_briefs (org_id, scope, location_id, brief_date, payload_json, data_quality) VALUES (?, ?, ?, ?, ?, ?)').run(o, scope, locationId, date, JSON.stringify(payload), data_quality)
  return payload
}

export const recipientSchema = z.object({
  email: z.string().trim().email('Email no válido').max(200),
  name: z.string().trim().max(120).optional().nullable(),
  roleInOrg: z.string().trim().max(60).optional().nullable(),
  scope: z.enum(['group', 'location']).optional(),
  locationId: z.number().int().positive().optional().nullable(),
  active: z.boolean().optional(),
})

export function listRecipients(ctx: Ctx) {
  return ctx.db.prepare('SELECT id, email, name, role_in_org, scope, location_id, active FROM report_recipients WHERE org_id = ? ORDER BY email').all(ctx.orgId)
}
export function createRecipient(ctx: Ctx, input: unknown) {
  const d = recipientSchema.parse(input)
  const scope = d.scope ?? (d.locationId ? 'location' : 'group')
  if (scope === 'location' && !d.locationId) throw new ValidationError('Un destinatario por local necesita centro')
  const r = ctx.db.prepare('INSERT INTO report_recipients (org_id, email, name, role_in_org, scope, location_id, active) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(ctx.orgId, d.email, d.name ?? null, d.roleInOrg ?? null, scope, scope === 'location' ? d.locationId : null, d.active === false ? 0 : 1)
  return ctx.db.prepare('SELECT id, email, name, role_in_org, scope, location_id, active FROM report_recipients WHERE id = ?').get(r.lastInsertRowid)
}
export function removeRecipient(ctx: Ctx, id: number): void {
  ctx.db.prepare('DELETE FROM report_recipients WHERE org_id = ? AND id = ?').run(ctx.orgId, id)
}
