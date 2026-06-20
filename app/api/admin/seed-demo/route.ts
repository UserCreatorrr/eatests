import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { seedDemoData } from '@/lib/seedData'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Deshabilitado salvo que INGEST_SECRET esté configurado (evita endpoint abierto).
  const expected = process.env.INGEST_SECRET
  const secret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.nextUrl.searchParams.get('secret')
  if (!expected || secret !== expected) return new NextResponse('Forbidden', { status: 403 })

  const email = req.nextUrl.searchParams.get('email')
  const uidParam = req.nextUrl.searchParams.get('uid')

  let uid: string
  if (uidParam) {
    uid = uidParam
  } else if (email) {
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim()) as any
    if (!user) {
      // No enumerar usuarios — solo confirmar que no existe.
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 })
    }
    uid = user.id
  } else {
    uid = 'pablo-admin'
  }

  seedDemoData(db, uid)

  const counts: Record<string, number> = {}
  for (const t of ['ingredientes','proveedores','pedidos_compra','albaranes_compra','facturas_compra',
    'albaranes_venta','facturas_venta','precio_historial','merma_registro','escandallo_receta','ventas_produccion',
    'locations','empleados','turnos','ventas_franja','targets_productividad','reports_recipients']) {
    try { counts[t] = (db.prepare(`SELECT COUNT(*) as c FROM ${t} WHERE user_id=?`).get(uid) as any).c } catch {}
  }

  return NextResponse.json({ ok: true, uid, counts })
}
