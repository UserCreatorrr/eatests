import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

const ALLOWED_TABLES = new Set([
  'ingredientes',
  'herramientas',
  'proveedores',
  'proveedores_detalle',
  'lista_pedidos',
  'pedidos_compra',
  'albaranes_compra',
  'albaranes_venta',
  'facturas_compra',
  'facturas_venta',
  'escandallo_receta',
])

// Map URL slugs to table names
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

export async function GET(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const table = TABLE_MAP[params.entity]
  if (!table || !ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: 'Entidad no válida' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '1000'), 5000)
  const offset = parseInt(searchParams.get('offset') || '0')

  const rows = db.prepare(`SELECT * FROM ${table} WHERE user_id = ? LIMIT ? OFFSET ?`).all(user.id, limit, offset)
  const { count } = db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE user_id = ?`).get(user.id) as { count: number }

  return NextResponse.json({ data: rows, count })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const table = TABLE_MAP[params.entity]
  if (!table || !ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: 'Entidad no válida' }, { status: 400 })
  }

  const body = await req.json()
  const { user_id: _skip, id: _id, ...fields } = body

  const columns = ['user_id', ...Object.keys(fields)]
  const values = [user.id, ...Object.values(fields)]
  const placeholders = columns.map(() => '?').join(', ')

  const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
  const result = stmt.run(...values)

  return NextResponse.json({ ok: true, id: result.lastInsertRowid })
}
