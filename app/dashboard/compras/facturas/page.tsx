import { supabaseAdmin } from '@/lib/supabase'
import { formatDate, formatCurrency, StatusBadge } from '@/components/DataTable'

async function getData() {
  const { data, count } = await supabaseAdmin
    .from('purchase_invoices')
    .select('*, cost_centers(name)', { count: 'exact' })
    .order('date', { ascending: false })
    .limit(200)
  return { rows: data || [], count: count || 0 }
}

export default async function FacturasCompraPage() {
  const { rows, count } = await getData()

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Facturas de Compra</h1>
        <p className="text-slate-500 mt-1">{count.toLocaleString('es-ES')} facturas</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Sin facturas importadas</div>
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
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-6 font-mono text-xs text-slate-400">{String(row.id).slice(0, 10)}</td>
                    <td className="px-6 font-medium text-slate-700">{row.vendor_name || '-'}</td>
                    <td className="px-6 text-slate-500">{formatDate(row.date)}</td>
                    <td className="px-6 font-semibold text-red-600">{formatCurrency(row.total)}</td>
                    <td className="px-6"><StatusBadge status={row.status} /></td>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <td className="px-6 text-slate-500">{(row as any).cost_centers?.name || '-'}</td>
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
