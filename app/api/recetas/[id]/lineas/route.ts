import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const lineas = db.prepare(`
    SELECT l.*, i.descr as ing_nombre, i.cost as ing_coste, i.unit as ing_unidad
    FROM escandallo_lineas l
    LEFT JOIN ingredientes i ON l.ingrediente_id = i.id
    WHERE l.receta_id = ? AND l.user_id = ?
    ORDER BY l.id ASC
  `).all(params.id, user.id)

  return NextResponse.json({ lineas })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { ingrediente_id, nombre_libre, cantidad, unidad } = body
  let { coste_unitario } = body

  if (!cantidad || cantidad <= 0) {
    return NextResponse.json({ error: 'Cantidad requerida' }, { status: 400 })
  }

  if (ingrediente_id && coste_unitario == null) {
    const ing = db.prepare('SELECT cost FROM ingredientes WHERE id = ? AND user_id = ?').get(ingrediente_id, user.id) as any
    if (ing?.cost) coste_unitario = ing.cost
  }

  const result = db.prepare(`
    INSERT INTO escandallo_lineas (receta_id, user_id, ingrediente_id, nombre_libre, cantidad, unidad, coste_unitario)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(params.id, user.id, ingrediente_id ?? null, nombre_libre ?? null, cantidad, unidad ?? null, coste_unitario ?? null)

  return NextResponse.json({ id: result.lastInsertRowid })
}
