import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

async function getComprasStats() {
  const [
    { count: orders },
    { count: deliveries },
    { count: invoices },
    { data: recentFacturas },
  ] = await Promise.all([
    supabaseAdmin.from('tspoonlab_pedidos_compra').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_albaranes_compra').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_facturas_compra').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('tspoonlab_facturas_compra')
      .select('id, invoice_num, vendor, date_invoice, total')
      .order('date_invoice', { ascending: false })
      .limit(10),
  ])

  return { orders, deliveries, invoices, recentFacturas: recentFacturas || [] }
}

export default async function ComprasPage() {
  const { orders, deliveries, invoices, recentFacturas } = await getComprasStats()

  const sections = [
    { label: 'Pedidos', count: orders || 0, href: '/dashboard/compras/pedidos', color: 'text-amber-600' },
    { label: 'Albaranes', count: deliveries || 0, href: '/dashboard/compras/albaranes', color: 'text-orange-600' },
    { label: 'Facturas', count: invoices || 0, href: '/dashboard/compras/facturas', color: 'text-red-600' },
  ]

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Compras</h1>
        <p className="text-slate-500 mt-1">Gestión de pedidos, albaranes y facturas de compra</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="stat-card hover:shadow-md transition-shadow group">
            <p className={`text-4xl font-bold ${s.color} mb-2`}>{s.count.toLocaleString('es-ES')}</p>
            <p className="text-slate-600 font-medium">{s.label}</p>
            <p className="text-blue-600 text-sm mt-3 group-hover:underline">Ver todos →</p>
          </Link>
        ))}
      </div>

      {/* Recent facturas compra */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Últimas facturas de compra</h2>
        </div>
        {recentFacturas.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Sin datos importados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-4">Nº Factura</th>
                  <th className="px-6 py-4">Proveedor</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentFacturas.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-6 font-mono text-sm text-slate-600">{f.invoice_num || '-'}</td>
                    <td className="px-6 font-medium text-slate-700">{f.vendor || '-'}</td>
                    <td className="px-6 text-slate-500">{f.date_invoice || '-'}</td>
                    <td className="px-6 font-semibold text-red-600">{formatCurrency(f.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
