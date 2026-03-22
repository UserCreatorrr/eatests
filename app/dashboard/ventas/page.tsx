import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

async function getVentasStats() {
  const [
    { count: deliveries },
    { count: invoices },
    { data: recentFacturas },
  ] = await Promise.all([
    supabaseAdmin.from('tspoonlab_albaranes_venta').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_facturas_venta').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('tspoonlab_facturas_venta')
      .select('id, invoice_num, customer, date_invoice, total')
      .order('date_invoice', { ascending: false })
      .limit(10),
  ])

  return { deliveries, invoices, recentFacturas: recentFacturas || [] }
}

export default async function VentasPage() {
  const { deliveries, invoices, recentFacturas } = await getVentasStats()

  const sections = [
    { label: 'Albaranes', count: deliveries || 0, href: '/dashboard/ventas/albaranes', color: 'text-green-600' },
    { label: 'Facturas', count: invoices || 0, href: '/dashboard/ventas/facturas', color: 'text-teal-600' },
  ]

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Ventas</h1>
        <p className="text-slate-500 mt-1">Gestión de albaranes y facturas de venta</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="stat-card hover:shadow-md transition-shadow group">
            <p className={`text-4xl font-bold ${s.color} mb-2`}>{s.count.toLocaleString('es-ES')}</p>
            <p className="text-slate-600 font-medium">{s.label}</p>
            <p className="text-blue-600 text-sm mt-3 group-hover:underline">Ver todos →</p>
          </Link>
        ))}
      </div>

      {/* Recent facturas venta */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Últimas facturas de venta</h2>
        </div>
        {recentFacturas.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Sin datos importados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-4">Nº Factura</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentFacturas.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-6 font-mono text-sm text-slate-600">{f.invoice_num || '-'}</td>
                    <td className="px-6 font-medium text-slate-700">{f.customer || '-'}</td>
                    <td className="px-6 text-slate-500">{f.date_invoice || '-'}</td>
                    <td className="px-6 font-semibold text-teal-600">{formatCurrency(f.total)}</td>
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
