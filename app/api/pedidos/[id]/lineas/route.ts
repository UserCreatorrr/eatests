import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { lineCost } from '@/lib/foodcost'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const pedido = db.prepare('SELECT id, num_order, vendor, date_order, total FROM pedidos_compra WHERE id=? AND user_id=?').get(params.id, user.id) as any
  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const lineas = db.prepare(`
    SELECT l.*, i.descr AS ing_nombre, i.unit AS ing_unidad, i.cost AS ing_coste
    FROM pedidos_compra_lineas l
    LEFT JOIN ingredientes i ON i.id = l.ingrediente_id
    WHERE l.pedido_id=? AND l.user_id=? ORDER BY l.id ASC
  `).all(params.id, user.id) as any[]

  const total_estimado = lineas.reduce((s, l) => s + (l.coste_estimado || 0), 0)
  return NextResponse.json({ pedido, lineas, total_estimado: Math.round(total_estimado * 100) / 100 })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const pedido = db.prepare('SELECT id FROM pedidos_compra WHERE id=? AND user_id=?').get(params.id, user.id) as any
  if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const b = await req.json()
  const ingId = b.ingrediente_id ? Number(b.ingrediente_id) : null
  const cantidad = b.cantidad != null ? Number(b.cantidad) : null
  let nombre = b.nombre || null
  let unidad = b.unidad || null
  let coste = b.coste_estimado != null ? Number(b.coste_estimado) : null

  // Si viene del catálogo, completar nombre/unidad/coste automáticamente (normalizado)
  if (ingId) {
    const ing = db.prepare('SELECT descr, unit, cost, almacen_principal FROM ingredientes WHERE id=? AND user_id=?').get(ingId, user.id) as any
    if (ing) {
      nombre = nombre || ing.descr
      unidad = unidad || ing.unit
      if (coste == null && cantidad != null && ing.cost) coste = Math.round(lineCost(cantidad, unidad, ing.cost, ing.unit) * 100) / 100
      if (!b.almacen_destino && ing.almacen_principal) b.almacen_destino = ing.almacen_principal
    }
  }

  db.prepare(`
    INSERT INTO pedidos_compra_lineas (user_id, pedido_id, ingrediente_id, nombre, cantidad, unidad, coste_estimado, almacen_destino)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, params.id, ingId, nombre, cantidad, unidad, coste, b.almacen_destino || null)

  // Recalcular total del pedido como suma de líneas
  syncTotal(params.id, user.id)
  return NextResponse.json({ ok: true, coste_estimado: coste })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { linea_id } = await req.json()
  db.prepare('DELETE FROM pedidos_compra_lineas WHERE id=? AND pedido_id=? AND user_id=?').run(linea_id, params.id, user.id)
  syncTotal(params.id, user.id)
  return NextResponse.json({ ok: true })
}

function syncTotal(pedidoId: string, uid: string) {
  const r = db.prepare('SELECT ROUND(SUM(coste_estimado),2) as t FROM pedidos_compra_lineas WHERE pedido_id=? AND user_id=?').get(pedidoId, uid) as any
  db.prepare('UPDATE pedidos_compra SET total=? WHERE id=? AND user_id=?').run(r?.t || 0, pedidoId, uid)
}
