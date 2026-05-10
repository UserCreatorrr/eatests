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

  return NextResponse.json({ alerts })
}
