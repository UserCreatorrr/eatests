import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Ficha agregada de un proveedor: datos + ingredientes asociados + pedidos +
// albaranes + facturas + últimos precios + cambios de precio.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = user.id

  const prov = db.prepare('SELECT * FROM proveedores WHERE id=? AND user_id=?').get(params.id, uid) as any
  if (!prov) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

  const nombre = prov.descr || ''
  const like = `%${nombre}%`

  // Ingredientes asociados (por proveedor_id)
  const ingredientes = db.prepare(`
    SELECT id, descr, type, unit, cost, iva, almacen_principal
    FROM ingredientes WHERE user_id=? AND proveedor_id=? ORDER BY descr LIMIT 200
  `).all(uid, prov.id) as any[]

  // Transacciones por nombre de vendor (denormalizado en compras)
  const pedidos = db.prepare(`
    SELECT id, num_order, date_order, total FROM pedidos_compra
    WHERE user_id=? AND vendor LIKE ? ORDER BY date_order DESC LIMIT 20
  `).all(uid, like) as any[]
  const albaranes = db.prepare(`
    SELECT id, delivery_num, date_delivery, total FROM albaranes_compra
    WHERE user_id=? AND vendor LIKE ? ORDER BY date_delivery DESC LIMIT 20
  `).all(uid, like) as any[]
  const facturas = db.prepare(`
    SELECT id, invoice_num, date_invoice, date_due, total, paid FROM facturas_compra
    WHERE user_id=? AND vendor LIKE ? ORDER BY date_invoice DESC LIMIT 20
  `).all(uid, like) as any[]

  // Últimos precios por ingrediente (de este proveedor) + cambio vs anterior
  const histRaw = db.prepare(`
    SELECT nombre, precio, fecha FROM precio_historial
    WHERE user_id=? AND vendor LIKE ? ORDER BY nombre, id ASC
  `).all(uid, like) as any[]
  const porIng: Record<string, { first: number; last: number; fecha: string }> = {}
  for (const h of histRaw) {
    if (!porIng[h.nombre]) porIng[h.nombre] = { first: h.precio, last: h.precio, fecha: h.fecha }
    porIng[h.nombre].last = h.precio
    porIng[h.nombre].fecha = h.fecha
  }
  const ultimos_precios = Object.entries(porIng).map(([nombre, v]) => ({
    nombre,
    precio: v.last,
    fecha: v.fecha,
    cambio_pct: v.first > 0 && Math.abs(v.last - v.first) > 0.00005 ? Math.round(((v.last - v.first) / v.first) * 100) : 0,
  })).sort((a, b) => Math.abs(b.cambio_pct) - Math.abs(a.cambio_pct)).slice(0, 30)

  const totals = {
    ingredientes: ingredientes.length,
    pedidos: pedidos.length,
    albaranes: albaranes.length,
    facturas: facturas.length,
    facturas_pendientes: facturas.filter(f => !f.paid).length,
    importe_pendiente: facturas.filter(f => !f.paid).reduce((s, f) => s + (f.total || 0), 0),
    gasto_total: facturas.reduce((s, f) => s + (f.total || 0), 0),
  }

  return NextResponse.json({ proveedor: prov, totals, ingredientes, pedidos, albaranes, facturas, ultimos_precios })
}
