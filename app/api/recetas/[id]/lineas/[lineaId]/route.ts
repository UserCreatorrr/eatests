import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: { id: string; lineaId: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  db.prepare('DELETE FROM escandallo_lineas WHERE id = ? AND user_id = ?').run(params.lineaId, user.id)

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; lineaId: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { cantidad, coste_unitario } = body

  if (cantidad != null) {
    db.prepare('UPDATE escandallo_lineas SET cantidad = ? WHERE id = ? AND user_id = ?').run(cantidad, params.lineaId, user.id)
  }
  if (coste_unitario != null) {
    db.prepare('UPDATE escandallo_lineas SET coste_unitario = ? WHERE id = ? AND user_id = ?').run(coste_unitario, params.lineaId, user.id)
  }

  return NextResponse.json({ ok: true })
}
