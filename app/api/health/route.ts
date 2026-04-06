import { NextResponse } from 'next/server'
import db from '@/lib/db'

const TABLE_MAP: Record<string, string> = {
  tspoonlab_proveedores: 'proveedores',
  tspoonlab_pedidos_compra: 'pedidos_compra',
  tspoonlab_albaranes_compra: 'albaranes_compra',
  tspoonlab_facturas_compra: 'facturas_compra',
  tspoonlab_albaranes_venta: 'albaranes_venta',
  tspoonlab_facturas_venta: 'facturas_venta',
  tspoonlab_ingredientes: 'ingredientes',
  tspoonlab_herramientas: 'herramientas',
  tspoonlab_lista_pedidos: 'lista_pedidos',
}

export async function GET() {
  const counts: Record<string, number | string> = {}

  for (const [key, table] of Object.entries(TABLE_MAP)) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as any
      counts[key] = row?.c ?? 0
    } catch (e: any) {
      counts[key] = `ERROR: ${e.message}`
    }
  }

  return NextResponse.json({
    status: 'ok',
    backend: 'sqlite',
    tables: counts,
  })
}
