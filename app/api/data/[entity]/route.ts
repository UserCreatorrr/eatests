import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { pickValidColumns, idIsText } from '@/lib/security'

export const dynamic = 'force-dynamic'

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
  // Labor + Productivity
  'locations',
  'empleados',
  'turnos',
  'ventas_franja',
  'targets_productividad',
  'reports_recipients',
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
  // Labor + Productivity
  'locations': 'locations',
  'empleados': 'empleados',
  'turnos': 'turnos',
  'ventas-franja': 'ventas_franja',
  'targets': 'targets_productividad',
  'reports-recipients': 'reports_recipients',
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
  // Solo columnas reales de la tabla (descarta user_id y claves maliciosas)
  const fields: Record<string, unknown> = pickValidColumns(table, body)

  // UUID solo para tablas con id TEXT; las de id INTEGER usan autoincrement.
  if (!fields.id && idIsText(table)) fields.id = randomUUID()

  // Nº de pedido/albarán/factura autogenerado si el usuario no lo aporta (feedback P0)
  autoGenerarNumero(table, fields, user.id)

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Sin datos válidos' }, { status: 400 })
  }

  const columns = ['user_id', ...Object.keys(fields)]
  const values = [user.id, ...Object.values(fields)]
  const placeholders = columns.map(() => '?').join(', ')

  const stmt = db.prepare(`INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
  stmt.run(...values)

  return NextResponse.json({ ok: true, id: fields.id })
}

// Autogenera el número de documento si el usuario no lo ha rellenado.
// Formato: PREFIJO-YYYYMMDD-NNN (contador diario por usuario).
function autoGenerarNumero(table: string, fields: Record<string, unknown>, userId: string) {
  const config: Record<string, { col: string; prefix: string }> = {
    pedidos_compra:   { col: 'num_order',    prefix: 'PED' },
    albaranes_compra: { col: 'delivery_num', prefix: 'ALB' },
    facturas_compra:  { col: 'invoice_num',  prefix: 'FAC' },
  }
  const cfg = config[table]
  if (!cfg) return
  const actual = fields[cfg.col]
  if (actual != null && String(actual).trim() !== '') return  // respeta el valor manual

  const hoy = new Date()
  const ymd = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`
  const like = `${cfg.prefix}-${ymd}-%`
  const n = (db.prepare(`SELECT COUNT(*) as c FROM ${table} WHERE user_id=? AND ${cfg.col} LIKE ?`).get(userId, like) as any)?.c ?? 0
  fields[cfg.col] = `${cfg.prefix}-${ymd}-${String(n + 1).padStart(3, '0')}`
}
