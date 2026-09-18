import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'
import { costesRecetas } from '@/lib/escandallo'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const uid = user.id

  const filas = db.prepare(`SELECT * FROM escandallo_receta WHERE user_id = ? ORDER BY nombre`).all(uid) as any[]
  // El motor resuelve subrecetas y merma; el SQL suelto no podía con lo primero.
  const costes = costesRecetas(uid)

  const result = filas.map(r => {
    const c = costes.get(r.id)
    return {
      ...r,
      coste_total: c ? c.coste_total : null,
      coste_racion: c ? c.coste_racion : null,
      food_cost_pct: c?.food_cost_pct ?? null,
      coste_unidad_producida: c?.coste_unidad_producida ?? null,
      // Para que la lista pueda avisar en vez de mostrar un coste engañoso.
      lineas_incompletas: c?.incompletas ?? 0,
      tiene_ciclo: c?.ciclo ?? false,
    }
  })

  return NextResponse.json({ recetas: result })
}
