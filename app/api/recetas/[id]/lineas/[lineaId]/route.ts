import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: { id: string; lineaId: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const info = db.prepare('DELETE FROM escandallo_lineas WHERE id = ? AND user_id = ?').run(params.lineaId, user.id)
  if (info.changes === 0) return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; lineaId: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const sets: string[] = []
  const vals: unknown[] = []

  // Cada campo se valida aparte: un número mal formado llegaba antes a SQLite
  // como texto y el coste pasaba a contar esa línea como 0 sin decir nada.
  if (body.cantidad != null && body.cantidad !== '') {
    const n = Number(body.cantidad)
    if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ error: 'La cantidad debe ser un número mayor que 0.' }, { status: 400 })
    sets.push('cantidad = ?'); vals.push(n)
  }
  if (body.coste_unitario != null && body.coste_unitario !== '') {
    const n = Number(body.coste_unitario)
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'El precio no puede ser negativo.' }, { status: 400 })
    sets.push('coste_unitario = ?'); vals.push(n)
  }
  if (body.merma_pct !== undefined) {
    const n = body.merma_pct === '' || body.merma_pct === null ? 0 : Number(body.merma_pct)
    if (!Number.isFinite(n) || n < 0 || n > 95) return NextResponse.json({ error: 'La merma debe estar entre 0 y 95%.' }, { status: 400 })
    sets.push('merma_pct = ?'); vals.push(n)
  }

  if (!sets.length) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

  const info = db.prepare(`UPDATE escandallo_lineas SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`)
    .run(...vals, params.lineaId, user.id)
  if (info.changes === 0) return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
