import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/gmail'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { to, subject, body, proveedor, items } = await req.json()
  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Faltan campos: to, subject, body' }, { status: 400 })
  }

  try {
    // 1. Send the email
    await sendEmail(to, subject, body)

    // 2. Create pedido_compra record
    const today = new Date().toISOString().split('T')[0]
    const year = new Date().getFullYear()
    const month = new Date().getMonth() + 1

    // Auto-generate order number: PED-YYYYMMDD-XXX
    const count = (db.prepare(
      "SELECT COUNT(*) as c FROM pedidos_compra WHERE user_id=? AND date_order=?"
    ).get(user.id, today) as any).c
    const num_order = `PED-${today.replace(/-/g, '')}-${String(count + 1).padStart(3, '0')}`

    const pedido = db.prepare(`
      INSERT INTO pedidos_compra (user_id, num_order, vendor, date_order, sent_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, num_order, proveedor || to, today, 'email')

    const pedidoId = pedido.lastInsertRowid

    // 3. Register in lista_pedidos as pending_receive
    db.prepare(`
      INSERT INTO lista_pedidos (user_id, descr, year, month, pending_send, pending_receive)
      VALUES (?, ?, ?, ?, 0, 1)
    `).run(user.id, `Pedido a ${proveedor || to} — ${num_order}`, year, month)

    // 4. Save line items to lineas_albaran_compra as "pending" (precio_unitario null = not yet received)
    if (Array.isArray(items) && items.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO lineas_albaran_compra (user_id, albaran_id, vendor, nombre, cantidad, unidad, fecha)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      for (const item of items) {
        if (item.nombre) {
          stmt.run(user.id, pedidoId, proveedor || to, item.nombre, item.cantidad ?? null, item.unidad ?? null, today)
        }
      }
    }

    return NextResponse.json({ ok: true, pedidoId, num_order })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
