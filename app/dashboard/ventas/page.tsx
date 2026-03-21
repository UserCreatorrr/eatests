import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { formatDate, formatCurrency, StatusBadge } from '@/components/DataTable'

async function getVentasStats() {
  const [
    { count: deliveries },
    { count: invoices },
    { data: recentInvoices },
  ] = await Promise.all([
    supabaseAdmin.from('sales_deliveries').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('sales_invoices').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('sales_invoices')
      .select('*, cost_centers(name)')
      .order('date', { ascending: false })
      .limit(10),
  ])

  return { deliveries, invoices, recentInvoices: recentInvoices || [] }
}

export default async function VentasPage() {
  const { deliveries, invoices, recentInvoices } = await getVentasStats()

  const sections = [
    { label: 'Albaranes', count: deliveries || 0, href: '/dashboard/ventas/albaranes', color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Facturas', count: invoices || 0, href: '/dashboard/ventas/facturas', color: 'text-teal-600', bg: 'bg-teal-50' },
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Últimas facturas de venta</h2>
        </div>
        {recentInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Sin datos importados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Centro</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-6 font-mono text-xs text-slate-400">{String(inv.id).slice(0, 10)}</td>
                    <td className="px-6 text-slate-500">{formatDate(inv.date)}</td>
                    <td className="px-6 font-semibold text-green-600">{formatCurrency(inv.total)}</td>
                    <td className="px-6"><StatusBadge status={inv.status} /></td>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <td className="px-6 text-slate-500">{(inv as any).cost_centers?.name || '-'}</td>
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
