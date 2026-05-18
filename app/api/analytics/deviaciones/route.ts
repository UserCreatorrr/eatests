import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const uid = user?.id ?? ''

  // Full price history per ingredient
  const historial = db.prepare(`
    SELECT nombre, vendor, precio, unidad, fecha, fuente
    FROM precio_historial
    WHERE user_id = ?
    ORDER BY nombre, fecha DESC
  `).all(uid) as any[]

  // Group by ingredient
  const byIngredient: Record<string, any[]> = {}
  for (const r of historial) {
    if (!byIngredient[r.nombre]) byIngredient[r.nombre] = []
    byIngredient[r.nombre].push(r)
  }

  // Monthly spend per ingredient from purchase lines
  const lineasMensuales = db.prepare(`
    SELECT nombre,
      SUM(CASE WHEN strftime('%Y-%m', fecha) = strftime('%Y-%m', date('now')) THEN total_linea ELSE 0 END) as gasto_mes_actual,
      SUM(CASE WHEN strftime('%Y-%m', fecha) = strftime('%Y-%m', date('now', '-1 month')) THEN total_linea ELSE 0 END) as gasto_mes_anterior,
      SUM(total_linea) as gasto_total,
      COUNT(*) as n_compras
    FROM lineas_albaran_compra
    WHERE user_id = ?
    GROUP BY nombre
  `).all(uid) as any[]

  const gastoMap: Record<string, any> = {}
  for (const l of lineasMensuales) {
    gastoMap[l.nombre] = l
  }

  const desviaciones: any[] = []
  for (const [nombre, registros] of Object.entries(byIngredient)) {
    if (registros.length < 2) continue
    const ultimo = registros[0]
    const anterior = registros[1]
    const pct = anterior.precio > 0
      ? Math.round(((ultimo.precio - anterior.precio) / anterior.precio) * 100)
      : null
    if (pct !== null && Math.abs(pct) >= 3) {
      const gasto = gastoMap[nombre]
      const gastoBase = gasto?.gasto_mes_actual || gasto?.gasto_mes_anterior || 0
      const impacto_mensual = gastoBase > 0
        ? Math.round((pct / 100) * gastoBase)
        : null
      const delta_eur = Math.round(ultimo.precio - anterior.precio * 100) / 100

      desviaciones.push({
        nombre,
        precio_actual: ultimo.precio,
        precio_anterior: anterior.precio,
        unidad: ultimo.unidad,
        vendor: ultimo.vendor,
        fecha: ultimo.fecha,
        variacion_pct: pct,
        delta_eur,
        impacto_mensual,
        n_registros: registros.length,
        alerta: Math.abs(pct) >= 15 ? 'alta' : Math.abs(pct) >= 8 ? 'media' : 'baja',
      })
    }
  }
  desviaciones.sort((a, b) => {
    // Sort by absolute impact € if available, else by %
    const aImp = Math.abs(a.impacto_mensual ?? a.variacion_pct)
    const bImp = Math.abs(b.impacto_mensual ?? b.variacion_pct)
    return bImp - aImp
  })

  // Vendor month-over-month spending
  const vendorTrend = db.prepare(`
    SELECT vendor,
      SUM(CASE WHEN strftime('%Y-%m', date_delivery) = strftime('%Y-%m', 'now') THEN total ELSE 0 END) as este_mes,
      SUM(CASE WHEN strftime('%Y-%m', date_delivery) = strftime('%Y-%m', date('now','-1 month')) THEN total ELSE 0 END) as mes_anterior,
      COUNT(*) as total_albaranes
    FROM albaranes_compra
    WHERE user_id = ? AND vendor IS NOT NULL
    GROUP BY vendor
    HAVING (este_mes > 0 OR mes_anterior > 0)
    ORDER BY ABS(este_mes - mes_anterior) DESC
    LIMIT 15
  `).all(uid) as any[]

  const vendorDesvs = vendorTrend
    .filter(v => v.mes_anterior > 0 && v.este_mes > 0)
    .map(v => ({
      ...v,
      variacion_pct: Math.round(((v.este_mes - v.mes_anterior) / v.mes_anterior) * 100),
      variacion_eur: Math.round(v.este_mes - v.mes_anterior),
    }))
    .filter(v => Math.abs(v.variacion_pct) >= 5)

  // Line items from scanned albaranes
  const lineas = db.prepare(`
    SELECT nombre, vendor, precio_unitario, unidad, fecha, cantidad, total_linea
    FROM lineas_albaran_compra
    WHERE user_id = ? AND precio_unitario > 0
    ORDER BY nombre, fecha DESC
  `).all(uid) as any[]

  // Detect price inconsistencies across vendors for same product
  const byProduct: Record<string, any[]> = {}
  for (const l of lineas) {
    if (!byProduct[l.nombre]) byProduct[l.nombre] = []
    byProduct[l.nombre].push(l)
  }

  const inconsistencias: any[] = []
  for (const [nombre, items] of Object.entries(byProduct)) {
    const vendors = Array.from(new Set(items.map((i: any) => i.vendor).filter(Boolean)))
    if (vendors.length < 2) continue
    const byVendor = vendors.map(v => {
      const last = items.find(i => i.vendor === v)
      return { vendor: v, precio: last?.precio_unitario, unidad: last?.unidad, fecha: last?.fecha }
    })
    const precios = byVendor.map(v => v.precio).filter(p => p > 0) as number[]
    if (precios.length < 2) continue
    const max = Math.max(...precios)
    const min = Math.min(...precios)
    const diff_pct = Math.round(((max - min) / min) * 100)
    if (diff_pct >= 10) {
      inconsistencias.push({ nombre, vendors: byVendor, diff_pct, ahorro_potencial: Math.round(max - min) })
    }
  }

  // Return full historial grouped by ingredient for detail view
  const historialByIngrediente: Record<string, any[]> = byIngredient

  // Recent purchase lines per ingredient (for detail)
  const lineasByIngrediente: Record<string, any[]> = {}
  for (const l of lineas) {
    if (!lineasByIngrediente[l.nombre]) lineasByIngrediente[l.nombre] = []
    if (lineasByIngrediente[l.nombre].length < 10) lineasByIngrediente[l.nombre].push(l)
  }

  return NextResponse.json({
    desviaciones,
    vendorTrend: vendorDesvs,
    inconsistencias,
    historialByIngrediente,
    lineasByIngrediente,
  })
}
