import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'
import webpush from 'web-push'

const vapidConfigured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
if (vapidConfigured) {
  webpush.setVapidDetails(
    'mailto:admin@marginbites.com',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
}

async function sendPushToUser(userId: string, title: string, body: string, url: string) {
  if (!vapidConfigured) return
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId) as any[]
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url, tag: title })
      )
    } catch (e: any) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint)
      }
    }
  }
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const notifications = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30'
  ).all(user.id)

  const unread = (notifications as any[]).filter((n: any) => !n.read).length

  return NextResponse.json({ notifications, unread })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const uid = user.id
  let generated = 0

  function upsertNotification(type: string, title: string, body: string, urgency: string, link: string) {
    // Only insert if there's no notification of this type for today (read or unread)
    const existing = db.prepare(
      "SELECT id FROM notifications WHERE user_id = ? AND type = ? AND date(created_at) = date('now') LIMIT 1"
    ).get(uid, type)
    if (!existing) {
      db.prepare(
        'INSERT INTO notifications (user_id, type, title, body, urgency, link) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(uid, type, title, body, urgency, link)
      generated++
      if (urgency === 'alta') {
        sendPushToUser(uid, title, body, link).catch(() => {})
      }
    }
  }

  // 1. Ingredientes sin coste
  const sinCoste = (db.prepare(
    'SELECT COUNT(*) as c FROM ingredientes WHERE user_id = ? AND (cost IS NULL OR cost = 0)'
  ).get(uid) as any)?.c ?? 0
  if (sinCoste > 0) {
    upsertNotification(
      'stock_bajo',
      `${sinCoste} ingredientes sin coste registrado`,
      'Revisa y actualiza los costes de tus ingredientes',
      'media',
      '/dashboard/ingredientes'
    )
  }

  // 2. Pedidos pending_send > 0
  const pendSend = (db.prepare(
    'SELECT COUNT(*) as c FROM lista_pedidos WHERE user_id = ? AND pending_send > 0'
  ).get(uid) as any)?.c ?? 0
  if (pendSend > 0) {
    upsertNotification(
      'pedido_pendiente',
      `${pendSend} listas de pedidos pendientes de envio`,
      'Hay pedidos que aun no han sido enviados al proveedor',
      'alta',
      '/dashboard/lista-pedidos'
    )
  }

  // 3. Facturas vencen en 7 dias sin pagar
  const facVence = (db.prepare(
    "SELECT COUNT(*) as c FROM facturas_compra WHERE user_id = ? AND paid = 0 AND date_due IS NOT NULL AND date_due <= date('now', '+7 days')"
  ).get(uid) as any)?.c ?? 0
  if (facVence > 0) {
    upsertNotification(
      'factura_vence',
      `${facVence} facturas vencen en los proximos 7 dias`,
      'Revisa las facturas pendientes de pago',
      'alta',
      '/dashboard/compras/facturas'
    )
  }

  // 4. Pedidos pending_receive > 0
  const pendReceive = (db.prepare(
    'SELECT COUNT(*) as c FROM lista_pedidos WHERE user_id = ? AND pending_receive > 0'
  ).get(uid) as any)?.c ?? 0
  if (pendReceive > 0) {
    upsertNotification(
      'recepcion_pendiente',
      `${pendReceive} listas pendientes de recepcion`,
      'Hay pedidos que aun no han sido recibidos',
      'media',
      '/dashboard/lista-pedidos'
    )
  }

  return NextResponse.json({ generated })
}
