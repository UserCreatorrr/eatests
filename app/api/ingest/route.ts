/**
 * POST /api/ingest
 * Called by n8n after fetching all TSpoonLab data.
 * Header: Authorization: Bearer <INGEST_SECRET>
 * Body: { user_id, ingredientes, herramientas, proveedores, ... }
 * Field names must match TSpoonLab camelCase exactly (they map 1:1 to column names).
 */
import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

// Fields to skip even if present in TSpoonLab data
const SKIP_FIELDS = new Set([
  'rememberme', 'listOrderCenters', 'listLines', 'listLinesPending',
  'listTaxes', 'listContacts', 'listContact',
])

function isScalar(v: unknown): boolean {
  if (v === null || v === undefined) return true
  return typeof v !== 'object' && !Array.isArray(v)
}

function bulkInsert(table: string, userId: string, rows: Record<string, unknown>[]): number {
  if (!rows || rows.length === 0) return 0

  // Full replace: delete existing data for this user
  db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId)

  let inserted = 0
  for (const row of rows) {
    // Keep only scalar fields (skip arrays, objects, blacklisted keys)
    const fields: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      if (k === 'user_id') continue
      if (SKIP_FIELDS.has(k)) continue
      if (!isScalar(v)) continue
      fields[k] = v
    }

    const columns = ['user_id', ...Object.keys(fields)]
    const values = [userId, ...Object.values(fields)]
    const placeholders = columns.map(() => '?').join(', ')

    try {
      db.prepare(
        `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
      ).run(...values)
      inserted++
    } catch {
      // Skip rows whose fields don't match schema
    }
  }
  return inserted
}

type IngestPayload = {
  user_id: string
  ingredientes?: Record<string, unknown>[]
  herramientas?: Record<string, unknown>[]
  proveedores?: Record<string, unknown>[]
  proveedores_detalle?: Record<string, unknown>[]
  lista_pedidos?: Record<string, unknown>[]
  pedidos_compra?: Record<string, unknown>[]
  albaranes_compra?: Record<string, unknown>[]
  albaranes_venta?: Record<string, unknown>[]
  facturas_compra?: Record<string, unknown>[]
  facturas_venta?: Record<string, unknown>[]
}

export async function POST(req: NextRequest) {
  const ingestSecret = process.env.INGEST_SECRET
  if (ingestSecret) {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (token !== ingestSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let payload: IngestPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { user_id } = payload
  if (!user_id) return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id)
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const stats: Record<string, number> = {}

  const insertAll = db.transaction(() => {
    if (payload.ingredientes)       stats.ingredientes       = bulkInsert('ingredientes',       user_id, payload.ingredientes)
    if (payload.herramientas)       stats.herramientas       = bulkInsert('herramientas',       user_id, payload.herramientas)
    if (payload.proveedores)        stats.proveedores        = bulkInsert('proveedores',        user_id, payload.proveedores)
    if (payload.proveedores_detalle)stats.proveedores_detalle= bulkInsert('proveedores_detalle',user_id, payload.proveedores_detalle)
    if (payload.lista_pedidos)      stats.lista_pedidos      = bulkInsert('lista_pedidos',      user_id, payload.lista_pedidos)
    if (payload.pedidos_compra)     stats.pedidos_compra     = bulkInsert('pedidos_compra',     user_id, payload.pedidos_compra)
    if (payload.albaranes_compra)   stats.albaranes_compra   = bulkInsert('albaranes_compra',   user_id, payload.albaranes_compra)
    if (payload.albaranes_venta)    stats.albaranes_venta    = bulkInsert('albaranes_venta',    user_id, payload.albaranes_venta)
    if (payload.facturas_compra)    stats.facturas_compra    = bulkInsert('facturas_compra',    user_id, payload.facturas_compra)
    if (payload.facturas_venta)     stats.facturas_venta     = bulkInsert('facturas_venta',     user_id, payload.facturas_venta)
  })

  insertAll()

  console.log(`Ingest complete for user ${user_id}:`, stats)
  return NextResponse.json({ ok: true, stats })
}
