import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { sendWhatsAppText } from '@/lib/whatsapp'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { phone, message, proveedor, items } = await req.json()
  if (!phone || !message) return NextResponse.json({ error: 'phone y message son requeridos' }, { status: 400 })

  const result = await sendWhatsAppText(phone, message)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  // Create purchase order record
  const today = new Date().toISOString().split('T')[0]
  const year = new Date().getFullYear()
  const month = String(new Date().getMonth() + 1).padStart(2, '0')
  const day   = String(new Date().getDate()).padStart(2, '0')
  const num_order = `WA-${year}${month}${day}-${Math.floor(Math.random() * 9000) + 1000}`

  const total = Array.isArray(items)
    ? items.reduce((s: number, i: any) => s + (i.precio_total || 0), 0)
    : 0

  db.prepare(`
    INSERT INTO pedidos_compra (user_id, num_order, vendor, date_order, sent_by, total)
    VALUES (?, ?, ?, ?, 'whatsapp', ?)
  `).run(user.id, num_order, proveedor || '', today, total)

  return NextResponse.json({ ok: true, num_order })
}
