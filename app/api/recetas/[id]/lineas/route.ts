import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'
import { unidadesCompatibles } from '@/lib/foodcost'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const lineas = db.prepare(`
    SELECT l.*, i.descr as ing_nombre, i.cost as ing_coste, i.unit as ing_unidad
    FROM escandallo_lineas l
    LEFT JOIN ingredientes i ON l.ingrediente_id = i.id AND i.user_id = l.user_id
    WHERE l.receta_id = ? AND l.user_id = ?
    ORDER BY l.id ASC
  `).all(params.id, user.id)

  return NextResponse.json({ lineas })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // La receta debe ser de quien llama: si no, no se cuelgan líneas de ella.
  const receta = db.prepare('SELECT id FROM escandallo_receta WHERE id = ? AND user_id = ?').get(params.id, user.id)
  if (!receta) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })

  const body = await req.json()
  const { ingrediente_id, nombre_libre, cantidad, unidad } = body
  let { coste_unitario } = body

  if (!cantidad || cantidad <= 0) {
    return NextResponse.json({ error: 'Cantidad requerida' }, { status: 400 })
  }

  if (ingrediente_id) {
    // El ingrediente debe ser del mismo usuario (no se referencia el de otro cliente)
    const ing = db.prepare('SELECT cost, unit FROM ingredientes WHERE id = ? AND user_id = ?').get(ingrediente_id, user.id) as any
    if (!ing) return NextResponse.json({ error: 'Ingrediente no encontrado' }, { status: 404 })
    // Unidad de la misma magnitud que la del ingrediente (14 ud de algo en kg no vale)
    if (!unidadesCompatibles(unidad, ing.unit)) {
      return NextResponse.json({ error: `La unidad "${unidad}" no es compatible con "${ing.unit}" del ingrediente. Usa una unidad de la misma magnitud.` }, { status: 400 })
    }
    if (coste_unitario == null && ing.cost) coste_unitario = ing.cost
  }

  const result = db.prepare(`
    INSERT INTO escandallo_lineas (receta_id, user_id, ingrediente_id, nombre_libre, cantidad, unidad, coste_unitario)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(params.id, user.id, ingrediente_id ?? null, nombre_libre ?? null, cantidad, unidad ?? null, coste_unitario ?? null)

  return NextResponse.json({ id: result.lastInsertRowid })
}
