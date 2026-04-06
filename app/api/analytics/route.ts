import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const uid = user.id

  const gastoMensual = db.prepare(`
    SELECT strftime('%Y-%m', date_order) as mes,
           ROUND(SUM(total),2) as total,
           COUNT(*) as num_pedidos
    FROM pedidos_compra
    WHERE user_id=? AND date_order IS NOT NULL AND date_order != ''
    GROUP BY mes ORDER BY mes ASC LIMIT 12
  `).all(uid)

  const topProveedores = db.prepare(`
    SELECT vendor, ROUND(SUM(total),2) as total, COUNT(*) as pedidos
    FROM pedidos_compra
    WHERE user_id=? AND vendor IS NOT NULL AND vendor != ''
    GROUP BY vendor ORDER BY total DESC LIMIT 5
  `).all(uid)

  const facturaStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN paid=1 THEN 1 ELSE 0 END) as pagadas,
      SUM(CASE WHEN paid=0 OR paid IS NULL THEN 1 ELSE 0 END) as pendientes,
      ROUND(SUM(CASE WHEN paid=0 OR paid IS NULL THEN total ELSE 0 END),2) as importe_pendiente,
      ROUND(SUM(total),2) as importe_total
    FROM facturas_compra WHERE user_id=?
  `).get(uid)

  const gastoEsteMes = (db.prepare(`
    SELECT ROUND(SUM(total),2) as v FROM pedidos_compra
    WHERE user_id=? AND strftime('%Y-%m', date_order) = strftime('%Y-%m', 'now')
  `).get(uid) as any)?.v ?? 0

  const gastoMesAnterior = (db.prepare(`
    SELECT ROUND(SUM(total),2) as v FROM pedidos_compra
    WHERE user_id=? AND strftime('%Y-%m', date_order) = strftime('%Y-%m', date('now','-1 month'))
  `).get(uid) as any)?.v ?? 0

  const ingredientesSinCoste = (db.prepare(`
    SELECT COUNT(*) as c FROM ingredientes WHERE user_id=? AND (cost IS NULL OR cost=0)
  `).get(uid) as any)?.c ?? 0

  const totalIngredientes = (db.prepare(`
    SELECT COUNT(*) as c FROM ingredientes WHERE user_id=?
  `).get(uid) as any)?.c ?? 0

  const numProveedores = (db.prepare(`
    SELECT COUNT(*) as c FROM proveedores WHERE user_id=?
  `).get(uid) as any)?.c ?? 0

  const recetasActivas = (db.prepare(`
    SELECT COUNT(*) as c FROM escandallo_receta WHERE user_id=? AND activo=1
  `).get(uid) as any)?.c ?? 0

  const gastoPorMesActual = db.prepare(`
    SELECT vendor, ROUND(SUM(total),2) as total
    FROM pedidos_compra
    WHERE user_id=? AND strftime('%Y-%m', date_order) = strftime('%Y-%m', 'now')
    GROUP BY vendor ORDER BY total DESC LIMIT 8
  `).all(uid)

  return NextResponse.json({
    gastoMensual,
    topProveedores,
    facturaStats,
    kpis: {
      gasto_este_mes: gastoEsteMes,
      gasto_mes_anterior: gastoMesAnterior,
      ingredientes_sin_coste: ingredientesSinCoste,
      total_ingredientes: totalIngredientes,
      num_proveedores: numProveedores,
      recetas_activas: recetasActivas,
    },
    gastoPorMesActual,
  })
}
