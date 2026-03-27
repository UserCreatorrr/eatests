import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET'

  const tables = [
    'tspoonlab_proveedores',
    'tspoonlab_pedidos_compra',
    'tspoonlab_albaranes_compra',
    'tspoonlab_facturas_compra',
    'tspoonlab_albaranes_venta',
    'tspoonlab_facturas_venta',
    'tspoonlab_ingredientes',
    'tspoonlab_herramientas',
    'tspoonlab_lista_pedidos',
  ]

  const counts: Record<string, number | string> = {}

  for (const table of tables) {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select('*', { count: 'exact', head: true })
    counts[table] = error ? `ERROR: ${error.message}` : (count ?? 0)
  }

  return NextResponse.json({
    status: 'ok',
    supabase_url: url,
    tables: counts,
  })
}
