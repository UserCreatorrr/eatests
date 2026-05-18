import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const result = db.prepare(
    'UPDATE facturas_compra SET paid = 1 WHERE id = ? AND user_id = ?'
  ).run(params.id, user.id)

  if (result.changes === 0) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
