import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const uid = user?.id ?? ''

  // Recipes with their ingredients
  const recetas = db.prepare(`
    SELECT r.id, r.nombre, r.raciones, r.precio_venta, r.merma_pct
    FROM escandallo_receta r
    WHERE r.user_id = ? AND r.activo = 1
    ORDER BY r.nombre
  `).all(uid) as any[]

  const recetasConLineas = recetas.map(r => {
    const lineas = db.prepare(`
      SELECT el.nombre_libre, el.cantidad, el.unidad, el.coste_unitario, el.ingrediente_id,
             i.descr as ingrediente_nombre, i.cost as ingrediente_cost, i.unit as ingrediente_unit
      FROM escandallo_lineas el
      LEFT JOIN ingredientes i ON el.ingrediente_id = i.id
      WHERE el.receta_id = ? AND el.user_id = ?
    `).all(r.id, uid) as any[]

    const coste_ingredientes = lineas.reduce((sum, l) => {
      const cost = l.coste_unitario ?? l.ingrediente_cost ?? 0
      return sum + (l.cantidad * cost)
    }, 0)

    const merma_factor = r.merma_pct ? (1 + r.merma_pct / 100) : 1
    const coste_real = coste_ingredientes * merma_factor
    const food_cost_pct = r.precio_venta > 0 ? Math.round((coste_real / r.precio_venta) * 100) : null

    return { ...r, lineas, coste_ingredientes: Math.round(coste_ingredientes * 100) / 100, coste_real: Math.round(coste_real * 100) / 100, food_cost_pct }
  })

  // Production registered (portions sold/produced)
  const produccion = db.prepare(`
    SELECT vp.receta_id, vp.nombre, SUM(vp.raciones) as total_raciones, COUNT(*) as registros,
           strftime('%Y-%m', vp.fecha) as mes
    FROM ventas_produccion vp
    WHERE vp.user_id = ? AND strftime('%Y-%m', vp.fecha) = strftime('%Y-%m', 'now')
    GROUP BY vp.receta_id, vp.nombre
  `).all(uid) as any[]

  // Calculate theoretical consumption based on production
  const consumoTeorico: any[] = []
  for (const prod of produccion) {
    const receta = recetasConLineas.find(r => r.id === prod.receta_id)
    if (!receta) continue

    for (const linea of receta.lineas) {
      const consumo_esperado = linea.cantidad * prod.total_raciones
      const nombre = linea.ingrediente_nombre || linea.nombre_libre
      consumoTeorico.push({
        ingrediente: nombre,
        receta: receta.nombre,
        raciones_producidas: prod.total_raciones,
        consumo_esperado_por_racion: linea.cantidad,
        consumo_esperado_total: Math.round(consumo_esperado * 100) / 100,
        unidad: linea.unidad || linea.ingrediente_unit,
        coste_esperado: Math.round(consumo_esperado * (linea.coste_unitario ?? linea.ingrediente_cost ?? 0) * 100) / 100,
      })
    }
  }

  // Compare with actual purchases this month (from lineas_albaran_compra if available)
  const comprasReales = db.prepare(`
    SELECT nombre, SUM(cantidad) as total_comprado, unidad, SUM(total_linea) as coste_real
    FROM lineas_albaran_compra
    WHERE user_id = ? AND strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now')
    GROUP BY nombre, unidad
  `).all(uid) as any[]

  // Cross-reference theoretical vs real
  const comparativa: any[] = []
  const grouped: Record<string, number> = {}
  for (const c of consumoTeorico) {
    grouped[c.ingrediente] = (grouped[c.ingrediente] || 0) + c.consumo_esperado_total
  }
  for (const [ingrediente, teorico] of Object.entries(grouped)) {
    const real = comprasReales.find(c => c.nombre.toLowerCase().includes(ingrediente.toLowerCase()))
    comparativa.push({
      ingrediente,
      consumo_teorico: teorico,
      consumo_real: real?.total_comprado ?? null,
      diferencia: real ? Math.round((real.total_comprado - teorico) * 100) / 100 : null,
      coste_diferencia: real?.coste_real ? Math.round((real.coste_real - (grouped[ingrediente] * 0)) * 100) / 100 : null,
    })
  }

  return NextResponse.json({
    recetas: recetasConLineas,
    produccion,
    consumoTeorico,
    comparativa,
    tiene_datos_produccion: produccion.length > 0,
    tiene_lineas_albaran: comprasReales.length > 0,
  })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const uid = user?.id ?? ''
  const body = await req.json()
  const { receta_id, nombre, raciones, fecha, notas } = body

  if (!nombre && !receta_id) return NextResponse.json({ error: 'nombre o receta_id requerido' }, { status: 400 })

  const r = db.prepare(`
    INSERT INTO ventas_produccion (user_id, receta_id, nombre, raciones, fecha, notas)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uid, receta_id ?? null, nombre ?? null, raciones ?? 1, fecha ?? new Date().toISOString().split('T')[0], notas ?? null)

  return NextResponse.json({ id: r.lastInsertRowid })
}
