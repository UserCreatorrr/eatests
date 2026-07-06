import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'
import { COSTE_LINEA_SQL } from '@/lib/foodcost'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const uid = user.id

  // Coste normalizado por unidades (COSTE_LINEA_SQL); food cost por ración.
  const recetas = db.prepare(`
    SELECT r.*,
      (SELECT ROUND(SUM(${COSTE_LINEA_SQL}),4) FROM escandallo_lineas l
       LEFT JOIN ingredientes i ON l.ingrediente_id = i.id
       WHERE l.receta_id = r.id AND l.user_id = ?) as coste_total
    FROM escandallo_receta r WHERE r.user_id = ? ORDER BY r.nombre
  `).all(uid, uid) as any[]

  const result = recetas.map(r => {
    const raciones = r.raciones && r.raciones > 0 ? r.raciones : 1
    const costeRacion = r.coste_total != null ? r.coste_total / raciones : null
    return {
      ...r,
      coste_racion: costeRacion != null ? Math.round(costeRacion * 10000) / 10000 : null,
      food_cost_pct: costeRacion && r.precio_venta
        ? Math.round((costeRacion / r.precio_venta) * 10000) / 100
        : null,
    }
  })

  return NextResponse.json({ recetas: result })
}
