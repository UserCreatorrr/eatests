import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { pickValidColumns, idIsText, tableColumns, coerceAndValidate, requireNombre, ValidationError } from '@/lib/security'

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

  // Excluir columnas pesadas de los listados (la imagen del documento puede
  // pesar varios MB por fila; se sirve solo desde el endpoint de detalle).
  const cols = Array.from(tableColumns(table)).filter(c => c !== 'doc_image')
  const rows = db.prepare(`SELECT ${cols.join(', ')} FROM ${table} WHERE user_id = ? LIMIT ? OFFSET ?`).all(user.id, limit, offset)
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
  let fields: Record<string, unknown> = pickValidColumns(table, body)
  // …y además con el tipo y el rango correctos: la validación del formulario
  // se puede saltar llamando a la API directamente.
  try {
    requireNombre(table, fields)
    fields = coerceAndValidate(table, fields)
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }

  // Destinatario de informes: email válido y, si el scope es local, con centro.
  if (table === 'reports_recipients') {
    const email = String(fields.email ?? '')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Email de destinatario no válido' }, { status: 400 })
    if (fields.scope === 'local' && !fields.site_id) return NextResponse.json({ error: 'Un destinatario de ámbito local necesita un centro' }, { status: 400 })
  }

  // Cuadre de factura: base + IVA debe aproximar el total (no cierre silencioso).
  if ((table === 'facturas_compra' || table === 'facturas_venta')) {
    const base = Number(fields.base ?? 0), iva = Number(fields.taxes ?? 0), total = Number(fields.total ?? 0)
    if (total > 0 && base > 0 && Math.abs(base + iva - total) > Math.max(0.02, total * 0.01)) {
      return NextResponse.json({ error: `El total (${total}) no cuadra con base + IVA (${Math.round((base + iva) * 100) / 100}). Revisa los importes.` }, { status: 400 })
    }
  }

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

  // INSERT puro (no REPLACE): el id ya no llega del cliente, pero así una
  // colisión de PK falla en vez de pisar una fila existente, en silencio.
  const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
  const info = stmt.run(...values)

  // Devuelve el id real: el UUID generado o el autoincrement recién creado.
  return NextResponse.json({ ok: true, id: fields.id ?? info.lastInsertRowid })
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
