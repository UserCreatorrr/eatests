import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { pickValidColumns, coerceAndValidate, requireNombre, ValidationError } from '@/lib/security'

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
  'locations': 'locations',
  'empleados': 'empleados',
  'turnos': 'turnos',
  'ventas-franja': 'ventas_franja',
  'targets': 'targets_productividad',
  'reports-recipients': 'reports_recipients',
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
  const { id: _id, ...rest } = body
  // Solo columnas reales (descarta user_id, id y claves maliciosas)
  let fields: Record<string, unknown> = pickValidColumns(table, rest)
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: 'Sin datos' }, { status: 400 })
  try {
    requireNombre(table, fields)
    fields = coerceAndValidate(table, fields)
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }

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

  // No dejar huérfanas las líneas de receta: si el ingrediente está en uso, se
  // avisa con el número de recetas en vez de borrarlo en silencio. Con ?forzar=1
  // se borra igualmente (y se limpian sus líneas para no dejar filas colgando).
  if (table === 'ingredientes') {
    const uso = db.prepare(`
      SELECT COUNT(DISTINCT r.id) AS c FROM escandallo_lineas l
      JOIN escandallo_receta r ON r.id = l.receta_id AND r.user_id = l.user_id
      WHERE l.user_id = ? AND l.ingrediente_id = ?
    `).get(user.id, params.id) as any
    const forzar = new URL(req.url).searchParams.get('forzar') === '1'
    if (uso?.c > 0 && !forzar) {
      return NextResponse.json({ error: `Este ingrediente se usa en ${uso.c} receta(s). Quítalo de esas recetas o confirma el borrado.`, en_uso: uso.c }, { status: 409 })
    }
    if (uso?.c > 0 && forzar) {
      db.prepare('DELETE FROM escandallo_lineas WHERE user_id = ? AND ingrediente_id = ?').run(user.id, params.id)
    }
  }

  const result = db.prepare(
    `DELETE FROM ${table} WHERE user_id = ? AND id = ?`
  ).run(user.id, params.id)

  if (result.changes === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
