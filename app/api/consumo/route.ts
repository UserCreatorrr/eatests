import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { unitFactor, unidadDef } from '@/lib/foodcost'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = user.id

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
      // Coste conectado normalizando unidad de línea vs unidad del ingrediente (g→kg, ml→l)
      const cost = l.ingrediente_id != null
        ? (l.ingrediente_cost ?? l.coste_unitario ?? 0)
        : (l.coste_unitario ?? 0)
      const factor = l.ingrediente_id != null ? unitFactor(l.unidad, l.ingrediente_unit) : 1
      return sum + (l.cantidad * factor * cost)
    }, 0)

    const merma_factor = r.merma_pct ? (1 + r.merma_pct / 100) : 1
    const coste_real = coste_ingredientes * merma_factor
    // Food cost por ración (el escandallo produce `raciones`; el PVP es por ración)
    const raciones = r.raciones && r.raciones > 0 ? r.raciones : 1
    const food_cost_pct = r.precio_venta > 0 ? Math.round(((coste_real / raciones) / r.precio_venta) * 100) : null

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

    // Las cantidades del escandallo son para la receta completa (raciones definidas);
    // el consumo por ración se obtiene dividiendo entre las raciones de la receta.
    const racionesReceta = receta.raciones && receta.raciones > 0 ? receta.raciones : 1
    for (const linea of receta.lineas) {
      const porRacion = linea.cantidad / racionesReceta
      const consumo_esperado = porRacion * prod.total_raciones
      const nombre = linea.ingrediente_nombre || linea.nombre_libre
      consumoTeorico.push({
        ingrediente: nombre,
        receta: receta.nombre,
        raciones_producidas: prod.total_raciones,
        consumo_esperado_por_racion: Math.round(porRacion * 1000) / 1000,
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

  // Cross-reference teórico vs real.
  // CLAVE: el escandallo va en g/ml y las compras en kg/l, así que ambos lados se
  // convierten a la unidad BASE antes de restar. Sin esto se comparaba 2000 (g)
  // contra 20 (kg) y salía una diferencia de -1980 con el signo invertido.
  const aBase = (cantidad: number | null | undefined, unidad: string | null | undefined) => {
    const def = unidadDef(unidad)
    if (!def || cantidad == null) return null
    return { cantidad: cantidad * def.factorBase, unidad: def.base }
  }

  const comparativa: any[] = []
  const grouped: Record<string, { base: number | null; unidadBase: string | null; sinUnidad: boolean }> = {}
  for (const c of consumoTeorico) {
    const conv = aBase(c.consumo_esperado_total, c.unidad)
    const g = grouped[c.ingrediente] || (grouped[c.ingrediente] = { base: 0, unidadBase: null, sinUnidad: false })
    if (!conv) { g.sinUnidad = true; continue }
    g.base = (g.base ?? 0) + conv.cantidad
    g.unidadBase = conv.unidad
  }

  for (const [ingrediente, t] of Object.entries(grouped)) {
    const real = comprasReales.find(c => c.nombre.toLowerCase().includes(ingrediente.toLowerCase()))
    const realConv = real ? aBase(real.total_comprado, real.unidad) : null

    // Solo se compara si ambos lados tienen unidad reconocida y de la misma magnitud
    const comparable = t.base != null && !t.sinUnidad && realConv != null && realConv.unidad === t.unidadBase
    comparativa.push({
      ingrediente,
      unidad: t.unidadBase,
      consumo_teorico: t.base != null ? Math.round(t.base * 1000) / 1000 : null,
      consumo_real: realConv ? Math.round(realConv.cantidad * 1000) / 1000 : null,
      diferencia: comparable ? Math.round((realConv!.cantidad - t.base!) * 1000) / 1000 : null,
      comparable,
      motivo_no_comparable: comparable ? null
        : t.sinUnidad ? 'La receta tiene líneas sin unidad reconocida'
        : !real ? 'Sin compras registradas de este ingrediente en el mes'
        : !realConv ? 'La compra no tiene una unidad reconocida'
        : 'La receta y la compra usan magnitudes distintas',
      coste_real: real?.coste_real ?? null,
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
