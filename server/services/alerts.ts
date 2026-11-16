// Avisos calculados al vuelo. Cada aviso dice de dónde sale el dato y nunca
// afirma lo que no puede saber (sin stock no hay "stock bajo", solo "hace
// días que no se compra").
import { addDays, today } from '@/server/domain/dates'
import { fromCents } from '@/server/domain/money'
import type { Ctx } from '@/server/http/context'
import { listInvoices } from './purchasing'
import { criticalRecipes } from './recipes'
import { priceDeviations } from './analytics'
import { wasteInPeriod } from './waste'

export interface Alert {
  id: string
  tipo: 'danger' | 'warning' | 'info'
  titulo: string
  detalle: string
  chat?: string
  href?: string
  count?: number
}

const eur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
const plural = (n: number, s: string, p = s + 's') => `${n} ${n === 1 ? s : p}`

export function computeAlerts(ctx: Ctx, ref = today()): Alert[] {
  const o = ctx.orgId
  const alerts: Alert[] = []
  const q = (sql: string, ...p: (string | number)[]) => ctx.db.prepare(sql).get(o, ...p) as any

  const overdue = q(`SELECT COUNT(*) AS c, COALESCE(SUM(total_cents), 0) AS t FROM invoices WHERE org_id = ? AND status = 'pending' AND due_date < ?`, ref)
  if (overdue.c > 0) alerts.push({ id: 'facturas_vencidas', tipo: 'danger', titulo: `${plural(overdue.c, 'factura vencida', 'facturas vencidas')}`, detalle: `${eur(fromCents(overdue.t))} sin pagar`,
    chat: 'Muéstrame las facturas pendientes para pagarlas', href: '/dashboard/compras/facturas', count: overdue.c })

  const soon = q(`SELECT COUNT(*) AS c, COALESCE(SUM(total_cents), 0) AS t FROM invoices WHERE org_id = ? AND status = 'pending' AND due_date BETWEEN ? AND ?`, ref, addDays(ref, 7))
  if (soon.c > 0) alerts.push({ id: 'facturas_proximas', tipo: 'warning', titulo: `${soon.c} factura${soon.c > 1 ? 's' : ''} vence${soon.c > 1 ? 'n' : ''} en 7 días`, detalle: eur(fromCents(soon.t)),
    chat: 'Muéstrame las facturas pendientes para pagarlas', href: '/dashboard/compras/facturas', count: soon.c })

  const toSend = q(`SELECT COUNT(*) AS c FROM purchase_orders WHERE org_id = ? AND status = 'draft'`)
  if (toSend.c > 0) alerts.push({ id: 'pedidos_envio', tipo: 'warning', titulo: plural(toSend.c, 'pedido pendiente de envío', 'pedidos pendientes de envío'), detalle: 'Sin enviar al proveedor',
    chat: 'Qué pedidos tengo sin enviar', href: '/dashboard/compras/pedidos', count: toSend.c })

  const toReceive = q(`SELECT COUNT(*) AS c FROM purchase_orders WHERE org_id = ? AND status = 'sent'`)
  if (toReceive.c > 0) alerts.push({ id: 'pedidos_pendientes', tipo: 'info', titulo: plural(toReceive.c, 'pedido pendiente de recibir', 'pedidos pendientes de recibir'), detalle: 'Entregas aún sin confirmar',
    chat: 'Qué pedidos tengo pendientes de recibir', href: '/dashboard/compras/pedidos', count: toReceive.c })

  const review = q(`SELECT COUNT(*) AS c FROM delivery_notes WHERE org_id = ? AND status IN ('draft','review')`)
  if (review.c > 0) alerts.push({ id: 'albaranes_revision', tipo: 'info', titulo: plural(review.c, 'albarán sin validar', 'albaranes sin validar'), detalle: 'Hasta validarlos no actualizan precios ni stock',
    chat: 'Qué albaranes tengo pendientes de validar', href: '/dashboard/compras/albaranes', count: review.c })

  // La factura concilia lo recibido: sin albaranes (o si no le suman) no se sabe qué se paga.
  const toReview = listInvoices(ctx).filter(v => v.review).length
  if (toReview > 0) alerts.push({ id: 'facturas_revisar', tipo: 'info', titulo: plural(toReview, 'factura por revisar', 'facturas por revisar'), detalle: 'Sin albaranes vinculados, o sus albaranes no suman la base',
    chat: 'Qué facturas tengo por revisar', href: '/dashboard/compras/facturas?filtro=revisar', count: toReview })

  // Reposición: por frecuencia habitual de compra, no por existencias.
  const fresh = new Set(['pescado', 'marisco', 'carne', 'verdura', 'hongo', 'lácteo', 'lacteo', 'fruta', 'hierba', 'charcutería', 'charcuteria', 'panadería', 'panaderia'])
  const items = ctx.db.prepare(`SELECT i.category, MAX(d.delivery_date) AS last FROM ingredients i
                                LEFT JOIN delivery_note_lines l ON l.ingredient_id = i.id AND l.org_id = i.org_id
                                LEFT JOIN delivery_notes d ON d.id = l.delivery_note_id AND d.status IN ('validated','invoiced')
                                WHERE i.org_id = ? AND i.active = 1 AND i.supplier_id IS NOT NULL GROUP BY i.id`).all(o) as { category: string | null; last: string | null }[]
  const refMs = new Date(ref + 'T00:00:00Z').getTime()
  const reorder = items.filter(it => {
    const threshold = fresh.has((it.category ?? '').toLowerCase()) ? 7 : 30
    const days = it.last ? Math.floor((refMs - new Date(it.last + 'T00:00:00Z').getTime()) / 86400000) : 999
    return days >= threshold
  }).length
  if (reorder > 0) alerts.push({ id: 'reposicion', tipo: 'warning', titulo: `${plural(reorder, 'artículo', 'artículos')} sin comprar desde hace tiempo`, detalle: 'Según la frecuencia habitual de compra, no según existencias',
    chat: 'Quiero hacer un pedido', href: '/dashboard/compras/pedidos', count: reorder })

  const dev = priceDeviations(ctx, ref, 10)
  const ups = dev.deviations.filter(d => d.changePct > 10).slice(0, 3)
  if (ups.length) alerts.push({ id: 'precios_subida', tipo: 'warning', titulo: `${plural(ups.length, 'ingrediente ha subido de precio', 'ingredientes han subido de precio')}`,
    detalle: ups.map(u => `${u.name} +${u.changePct}%`).join(' · '), chat: 'Qué ingredientes han subido de precio', href: '/dashboard/analytics', count: ups.length })
  const inc = dev.inconsistencies.filter(i => i.diffPct >= 20).slice(0, 3)
  if (inc.length) alerts.push({ id: 'precio_diferencial', tipo: 'warning', titulo: `${plural(inc.length, 'ingrediente', 'ingredientes')} con diferencial de precio entre proveedores`,
    detalle: inc.map(i => `${i.name} +${i.diffPct}%`).join(' · '), chat: 'Muéstrame las oportunidades de ahorro comparando precios entre proveedores', href: '/dashboard/analytics', count: inc.length })

  // Ingredientes usados en recetas activas: sin coste (falsea el food cost) y sin proveedor (no se pueden pedir), por separado.
  const used = `FROM ingredients i JOIN recipe_lines l ON l.ingredient_id = i.id AND l.org_id = i.org_id JOIN recipes r ON r.id = l.recipe_id AND r.active = 1 WHERE i.org_id = ?`
  const noCost = q(`SELECT COUNT(DISTINCT i.id) AS c ${used} AND (i.cost IS NULL OR i.cost <= 0)`)
  if (noCost.c > 0) alerts.push({ id: 'ingredientes_sin_coste', tipo: 'danger', titulo: `${plural(noCost.c, 'ingrediente', 'ingredientes')} de tus escandallos sin coste`, detalle: 'Cuentan como 0 €: el food cost de esas recetas sale más bajo del real',
    chat: 'Qué ingredientes de mis escandallos no tienen coste', href: '/dashboard/ingredientes?filtro=sin_coste', count: noCost.c })
  const noSupplier = q(`SELECT COUNT(DISTINCT i.id) AS c ${used} AND i.supplier_id IS NULL`)
  if (noSupplier.c > 0) alerts.push({ id: 'ingredientes_sin_proveedor', tipo: 'info', titulo: `${plural(noSupplier.c, 'ingrediente', 'ingredientes')} de tus escandallos sin proveedor`, detalle: 'El coste es correcto, pero no se pueden pedir desde la app',
    chat: 'Qué ingredientes de mis escandallos no tienen proveedor', href: '/dashboard/ingredientes?filtro=sin_proveedor', count: noSupplier.c })

  const waste = wasteInPeriod(ctx, addDays(ref, -7), ref)
  if (waste.cost >= 50) alerts.push({ id: 'merma_elevada', tipo: 'warning', titulo: `Merma de ${eur(waste.cost)} en los últimos 7 días`, detalle: `${plural(waste.n, 'registro', 'registros')} de merma esta semana`,
    chat: 'Analiza la merma de esta semana y dime dónde se concentra', href: '/dashboard/merma', count: waste.n })

  const critical = criticalRecipes(ctx, 35, 5)
  if (critical.length) alerts.push({ id: 'food_cost_critico', tipo: 'danger', titulo: `${plural(critical.length, 'plato', 'platos')} con food cost crítico`, detalle: critical.map(r => `${r.name} ${r.foodCostPct}%`).join(' · '),
    chat: 'Qué platos tienen el food cost más alto', href: '/dashboard/sangrado', count: critical.length })

  return alerts
}
