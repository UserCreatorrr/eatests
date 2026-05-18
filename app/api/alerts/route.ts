import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export interface AlertItem {
  id: string
  tipo: 'danger' | 'warning' | 'info'
  titulo: string
  detalle: string
  chat?: string
  href?: string
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ alerts: [] })

  const userId = user.id
  const alerts: AlertItem[] = []

  // 1. Facturas vencidas
  const facVencidas = db.prepare(
    "SELECT COUNT(*) as c, ROUND(SUM(total),2) as t FROM facturas_compra WHERE user_id=? AND (paid=0 OR paid IS NULL) AND date_due < date('now')"
  ).get(userId) as any
  if (facVencidas.c > 0) {
    alerts.push({
      id: 'facturas_vencidas',
      tipo: 'danger',
      titulo: `${facVencidas.c} factura${facVencidas.c > 1 ? 's' : ''} vencida${facVencidas.c > 1 ? 's' : ''}`,
      detalle: `${facVencidas.t || 0} EUR sin pagar`,
      chat: 'Dime qué facturas están vencidas y qué tengo que hacer',
      href: '/dashboard/compras/facturas',
    })
  }

  // 2. Facturas que vencen en 5 días
  const facProximas = db.prepare(
    "SELECT COUNT(*) as c, ROUND(SUM(total),2) as t FROM facturas_compra WHERE user_id=? AND (paid=0 OR paid IS NULL) AND date_due BETWEEN date('now') AND date('now','+5 days')"
  ).get(userId) as any
  if (facProximas.c > 0) {
    alerts.push({
      id: 'facturas_proximas',
      tipo: 'warning',
      titulo: `${facProximas.c} factura${facProximas.c > 1 ? 's' : ''} vence${facProximas.c > 1 ? 'n' : ''} en 5 días`,
      detalle: `${facProximas.t || 0} EUR`,
      chat: 'Qué facturas vencen esta semana?',
      href: '/dashboard/compras/facturas',
    })
  }

  // 3. Pedidos pendientes de recibir
  const pedPend = db.prepare(
    "SELECT COUNT(*) as c FROM lista_pedidos WHERE user_id=? AND pending_receive=1"
  ).get(userId) as any
  if (pedPend.c > 0) {
    alerts.push({
      id: 'pedidos_pendientes',
      tipo: 'info',
      titulo: `${pedPend.c} pedido${pedPend.c > 1 ? 's' : ''} pendiente${pedPend.c > 1 ? 's' : ''} de recibir`,
      detalle: 'Entregas aún sin confirmar',
      chat: 'Qué pedidos tengo pendientes de recibir?',
      href: '/dashboard/compras/pedidos',
    })
  }

  // 4. Ingredientes con reposición overdue
  const items = db.prepare(`
    SELECT i.type,
           (SELECT MAX(l.fecha) FROM lineas_albaran_compra l
            WHERE l.user_id = i.user_id AND l.nombre = i.descr) AS ultima_fecha
    FROM ingredientes i
    JOIN proveedores p ON p.id = i.proveedor_id
    WHERE i.user_id = ?
  `).all(userId) as any[]

  const freshTypes = new Set(['Pescado','Marisco','Carne','Verdura','Hongo','Lácteo','Fruta','Hierba','Charcutería','Panadería'])
  const today = new Date()
  let reorderCount = 0
  for (const it of items) {
    const threshold = freshTypes.has(it.type) ? 7 : 30
    const daysSince = it.ultima_fecha
      ? Math.floor((today.getTime() - new Date(it.ultima_fecha).getTime()) / 86400000)
      : 999
    if (daysSince >= threshold) reorderCount++
  }
  if (reorderCount > 0) {
    alerts.push({
      id: 'reposicion',
      tipo: 'warning',
      titulo: `${reorderCount} artículo${reorderCount > 1 ? 's' : ''} con reposición pendiente`,
      detalle: 'Stock bajo según histórico de pedidos',
      chat: 'Quiero hacer un pedido',
    })
  }

  // 5. Subidas de precio >10%
  const allPrecios = db.prepare(
    'SELECT nombre, precio FROM precio_historial WHERE user_id=? ORDER BY nombre, id ASC'
  ).all(userId) as any[]
  const precioMap: Record<string, { first: number; last: number }> = {}
  for (const p of allPrecios) {
    if (!precioMap[p.nombre]) precioMap[p.nombre] = { first: p.precio, last: p.precio }
    precioMap[p.nombre].last = p.precio
  }
  const subidas = Object.entries(precioMap)
    .filter(([, v]) => v.first > 0 && ((v.last - v.first) / v.first) > 0.10)
    .sort((a, b) => ((b[1].last - b[1].first) / b[1].first) - ((a[1].last - a[1].first) / a[1].first))
    .slice(0, 3)

  if (subidas.length > 0) {
    alerts.push({
      id: 'precios_subida',
      tipo: 'warning',
      titulo: `${subidas.length} ingrediente${subidas.length > 1 ? 's' : ''} ha${subidas.length > 1 ? 'n' : ''} subido de precio`,
      detalle: subidas.map(([n, v]) => `${n} +${Math.round(((v.last - v.first) / v.first) * 100)}%`).join(' · '),
      chat: 'Qué ingredientes han subido de precio recientemente?',
      href: '/dashboard/analytics',
    })
  }

  // 6. Ingredientes con diferencia de precio >20% entre proveedores
  const preciosConVendor = db.prepare(
    'SELECT nombre, vendor, precio FROM precio_historial WHERE user_id=? AND vendor IS NOT NULL ORDER BY nombre, vendor, id DESC'
  ).all(userId) as any[]

  const latestByIngVendor: Record<string, Record<string, number>> = {}
  for (const p of preciosConVendor) {
    if (!latestByIngVendor[p.nombre]) latestByIngVendor[p.nombre] = {}
    if (!latestByIngVendor[p.nombre][p.vendor]) latestByIngVendor[p.nombre][p.vendor] = p.precio
  }

  const oportunidades = Object.entries(latestByIngVendor)
    .filter(([, vendors]) => Object.keys(vendors).length >= 2)
    .map(([nombre, vendors]) => {
      const precios = Object.values(vendors)
      const min = Math.min(...precios)
      const max = Math.max(...precios)
      const diffPct = min > 0 ? Math.round(((max - min) / min) * 100) : 0
      return { nombre, diffPct, min, max }
    })
    .filter(o => o.diffPct >= 20)
    .sort((a, b) => b.diffPct - a.diffPct)
    .slice(0, 3)

  if (oportunidades.length > 0) {
    alerts.push({
      id: 'precio_diferencial',
      tipo: 'warning',
      titulo: `${oportunidades.length} ingrediente${oportunidades.length > 1 ? 's' : ''} con diferencial de precio entre proveedores`,
      detalle: oportunidades.map(o => `${o.nombre} +${o.diffPct}%`).join(' · '),
      chat: 'Muéstrame las oportunidades de ahorro comparando precios entre proveedores',
    })
  }

  // 8. Recetas con food cost crítico (>35% con precios actuales)
  const recetasCriticas = db.prepare(`
    SELECT r.nombre, r.precio_venta,
           ROUND(SUM(
             CASE WHEN l.ingrediente_id IS NOT NULL AND i.cost IS NOT NULL THEN l.cantidad * i.cost
                  WHEN l.coste_unitario IS NOT NULL THEN l.cantidad * l.coste_unitario
                  ELSE 0 END
           ), 4) AS coste_total
    FROM escandallo_receta r
    JOIN escandallo_lineas l ON l.receta_id = r.id AND l.user_id = r.user_id
    LEFT JOIN ingredientes i ON i.id = l.ingrediente_id
    WHERE r.user_id = ? AND r.activo = 1 AND r.precio_venta > 0
    GROUP BY r.id
    HAVING CAST(coste_total AS REAL) / r.precio_venta > 0.35
    ORDER BY CAST(coste_total AS REAL) / r.precio_venta DESC
    LIMIT 5
  `).all(userId) as any[]

  if (recetasCriticas.length > 0) {
    const detalle = recetasCriticas
      .map(r => `${r.nombre} ${Math.round((r.coste_total / r.precio_venta) * 100)}%`)
      .join(' · ')
    alerts.push({
      id: 'food_cost_critico',
      tipo: 'danger',
      titulo: `${recetasCriticas.length} plato${recetasCriticas.length > 1 ? 's' : ''} con food cost crítico`,
      detalle,
      chat: 'Qué platos tienen el food cost más alto y cómo puedo reducirlo?',
      href: '/dashboard/sangrado',
    })
  }

  return NextResponse.json({ alerts })
}
