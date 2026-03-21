import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'

async function getComprasStats() {
  const [
    { count: orders },
    { count: deliveries },
    { count: invoices },
    { data: recentDeliveries },
  ] = await Promise.all([
    supabaseAdmin.from('purchase_orders').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('purchase_deliveries').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('purchase_invoices').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('purchase_deliveries')
      .select('*, cost_centers(name)')
      .order('date', { ascending: false })
      .limit(10),
  ])

  return { orders, deliveries, invoices, recentDeliveries: recentDeliveries || [] }
}

function formatDate(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('es-ES')
}

function formatCurrency(amount: number | null) {
  if (!amount) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default async function ComprasPage() {
  const { orders, deliveries, invoices, recentDeliveries } = await getComprasStats()

  const sections = [
    { label: 'Pedidos', count: orders || 0, href: '/dashboard/compras/pedidos', color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Albaranes', count: deliveries || 0, href: '/dashboard/compras/albaranes', color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Facturas', count: invoices || 0, href: '/dashboard/compras/facturas', color: 'text-red-600', bg: 'bg-red-50' },
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

      {/* Recent deliveries */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Últimos albaranes</h2>
        </div>
        {recentDeliveries.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Sin datos importados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Proveedor</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Centro</th>
                </tr>
              </thead>
              <tbody>
                {recentDeliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-6 font-mono text-xs text-slate-500">{String(d.id).slice(0, 8)}...</td>
                    <td className="px-6 font-medium text-slate-700">{d.vendor_name || '-'}</td>
                    <td className="px-6 text-slate-500">{formatDate(d.date)}</td>
                    <td className="px-6 font-semibold text-slate-800">{formatCurrency(d.total)}</td>
                    <td className="px-6">
                      <span className={`badge ${d.status === 'processed' ? 'badge-green' : d.status === 'pending' ? 'badge-yellow' : 'badge-gray'}`}>
                        {d.status || 'pendiente'}
                      </span>
                    </td>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <td className="px-6 text-slate-500">{(d as any).cost_centers?.name || '-'}</td>
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
