import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { seedDemoData } from '@/lib/seedData'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.INGEST_SECRET) return new NextResponse('Forbidden', { status: 403 })

  const email = req.nextUrl.searchParams.get('email')
  const uidParam = req.nextUrl.searchParams.get('uid')

  let uid: string
  if (uidParam) {
    uid = uidParam
  } else if (email) {
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any
    if (!user) return NextResponse.json({ ok: false, error: `User with email ${email} not found` }, { status: 404 })
    uid = user.id
  } else {
    uid = 'pablo-admin'
  }

  seedDemoData(db, uid)

  const counts: Record<string, number> = {}
  for (const t of ['ingredientes','proveedores','pedidos_compra','albaranes_compra','facturas_compra',
    'albaranes_venta','facturas_venta','precio_historial','merma_registro','escandallo_receta','ventas_produccion']) {
    counts[t] = (db.prepare(`SELECT COUNT(*) as c FROM ${t} WHERE user_id=?`).get(uid) as any).c
  }

  return NextResponse.json({ ok: true, uid, counts })
}
