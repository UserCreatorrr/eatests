import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const uid = user.id

  const recetas = db.prepare(`
    SELECT r.*,
      (SELECT ROUND(SUM(
        CASE WHEN l.coste_unitario IS NOT NULL THEN l.cantidad * l.coste_unitario
             WHEN i.cost IS NOT NULL THEN l.cantidad * i.cost
             ELSE 0 END
      ),4) FROM escandallo_lineas l
       LEFT JOIN ingredientes i ON l.ingrediente_id = i.id
       WHERE l.receta_id = r.id AND l.user_id = ?) as coste_total
    FROM escandallo_receta r WHERE r.user_id = ? ORDER BY r.nombre
  `).all(uid, uid) as any[]

  const result = recetas.map(r => ({
    ...r,
    food_cost_pct: r.coste_total && r.precio_venta
      ? Math.round((r.coste_total / r.precio_venta) * 10000) / 100
      : null,
  }))

  return NextResponse.json({ recetas: result })
}
