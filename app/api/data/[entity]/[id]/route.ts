import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const TABLE_MAP: Record<string, string> = {
  'ingredientes': 'ingredientes',
  'herramientas': 'herramientas',
  'proveedores': 'proveedores',
  'proveedores-detalle': 'proveedores_detalle',
  'lista-pedidos': 'lista_pedidos',
  'pedidos-compra': 'pedidos_compra',
  'albaranes-compra': 'albaranes_compra',
  'albaranes-venta': 'albaranes_venta',
  'facturas-compra': 'facturas_compra',
  'facturas-venta': 'facturas_venta',
  'escandallo-receta': 'escandallo_receta',
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { entity: string; id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const table = TABLE_MAP[params.entity]
  if (!table) return NextResponse.json({ error: 'Entidad no valida' }, { status: 400 })

  const body = await req.json()
  const { user_id: _u, id: _id, ...fields } = body
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: 'Sin datos' }, { status: 400 })

  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ')
  const values = [...Object.values(fields), user.id, params.id]

  const result = db.prepare(
    `UPDATE ${table} SET ${sets} WHERE user_id = ? AND id = ?`
  ).run(...values)

  if (result.changes === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { entity: string; id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const table = TABLE_MAP[params.entity]
  if (!table) return NextResponse.json({ error: 'Entidad no valida' }, { status: 400 })

  const result = db.prepare(
    `DELETE FROM ${table} WHERE user_id = ? AND id = ?`
  ).run(user.id, params.id)

  if (result.changes === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
