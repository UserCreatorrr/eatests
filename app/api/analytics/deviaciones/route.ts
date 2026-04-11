import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const uid = user?.id ?? ''

  // Price history per ingredient
  const historial = db.prepare(`
    SELECT nombre, vendor, precio, unidad, fecha, fuente
    FROM precio_historial
    WHERE user_id = ?
    ORDER BY nombre, fecha DESC
  `).all(uid) as any[]

  // Group by ingredient to detect changes
  const byIngredient: Record<string, any[]> = {}
  for (const r of historial) {
    if (!byIngredient[r.nombre]) byIngredient[r.nombre] = []
    byIngredient[r.nombre].push(r)
  }

  const desviaciones: any[] = []
  for (const [nombre, registros] of Object.entries(byIngredient)) {
    if (registros.length < 2) continue
    const ultimo = registros[0]
    const anterior = registros[1]
    const pct = anterior.precio > 0
      ? Math.round(((ultimo.precio - anterior.precio) / anterior.precio) * 100)
      : null
    if (pct !== null && Math.abs(pct) >= 5) {
      desviaciones.push({
        nombre,
        precio_actual: ultimo.precio,
        precio_anterior: anterior.precio,
        unidad: ultimo.unidad,
        vendor: ultimo.vendor,
        fecha: ultimo.fecha,
        variacion_pct: pct,
        alerta: Math.abs(pct) >= 15 ? 'alta' : Math.abs(pct) >= 8 ? 'media' : 'baja',
      })
    }
  }
  desviaciones.sort((a, b) => Math.abs(b.variacion_pct) - Math.abs(a.variacion_pct))

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

  // Line items from scanned albaranes: price history per product
  const lineas = db.prepare(`
    SELECT nombre, vendor, precio_unitario, unidad, fecha
    FROM lineas_albaran_compra
    WHERE user_id = ? AND precio_unitario > 0
    ORDER BY nombre, fecha DESC
  `).all(uid) as any[]

  // Detect same product from different vendors (price inconsistency)
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

  return NextResponse.json({ desviaciones, vendorTrend: vendorDesvs, inconsistencias })
}
