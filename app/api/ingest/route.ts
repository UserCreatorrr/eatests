/**
 * POST /api/ingest
 * Called by the n8n workflow after it fetches all TSpoonLab data.
 * n8n must include:
 *   - Header: Authorization: Bearer <INGEST_SECRET>
 *   - Body: { user_id, ingredientes, herramientas, proveedores, ... }
 */
import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

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

function bulkInsert(table: string, userId: string, rows: Record<string, unknown>[]) {
  if (!rows || rows.length === 0) return 0

  // Delete existing data for this user to do a full replace
  db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId)

  let inserted = 0
  for (const row of rows) {
    const { id: _id, user_id: _uid, ...fields } = row
    const columns = ['user_id', ...Object.keys(fields)]
    const values = [userId, ...Object.values(fields)]
    const placeholders = columns.map(() => '?').join(', ')
    try {
      db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...values)
      inserted++
    } catch {
      // Skip rows with schema mismatches
    }
  }
  return inserted
}

export async function POST(req: NextRequest) {
  // Validate secret token
  const ingestSecret = process.env.INGEST_SECRET
  if (ingestSecret) {
    const auth = req.headers.get('authorization')
    const token = auth?.replace('Bearer ', '')
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
  if (!user_id) {
    return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })
  }

  // Verify user exists
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id)
  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const stats: Record<string, number> = {}

  const insertAll = db.transaction(() => {
    if (payload.ingredientes) stats.ingredientes = bulkInsert('ingredientes', user_id, payload.ingredientes)
    if (payload.herramientas) stats.herramientas = bulkInsert('herramientas', user_id, payload.herramientas)
    if (payload.proveedores) stats.proveedores = bulkInsert('proveedores', user_id, payload.proveedores)
    if (payload.proveedores_detalle) stats.proveedores_detalle = bulkInsert('proveedores_detalle', user_id, payload.proveedores_detalle)
    if (payload.lista_pedidos) stats.lista_pedidos = bulkInsert('lista_pedidos', user_id, payload.lista_pedidos)
    if (payload.pedidos_compra) stats.pedidos_compra = bulkInsert('pedidos_compra', user_id, payload.pedidos_compra)
    if (payload.albaranes_compra) stats.albaranes_compra = bulkInsert('albaranes_compra', user_id, payload.albaranes_compra)
    if (payload.albaranes_venta) stats.albaranes_venta = bulkInsert('albaranes_venta', user_id, payload.albaranes_venta)
    if (payload.facturas_compra) stats.facturas_compra = bulkInsert('facturas_compra', user_id, payload.facturas_compra)
    if (payload.facturas_venta) stats.facturas_venta = bulkInsert('facturas_venta', user_id, payload.facturas_venta)
  })

  insertAll()

  console.log(`Ingest complete for user ${user_id}:`, stats)
  return NextResponse.json({ ok: true, stats })
}
