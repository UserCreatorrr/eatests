import { supabaseAdmin } from '@/lib/supabase'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

async function getData() {
  const { data, count } = await supabaseAdmin
    .from('tspoonlab_albaranes_compra')
    .select('id, delivery_num, vendor, date_delivery, base, taxes, total, cost_type', { count: 'exact' })
    .order('date_delivery', { ascending: false })
    .limit(500)

  return { rows: data || [], count: count || 0 }
}

export default async function AlbaranesCompraPage() {
  const { rows, count } = await getData()

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Albaranes de Compra</h1>
        <p className="text-slate-500 mt-1">{count.toLocaleString('es-ES')} albaranes</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p>Sin albaranes de compra importados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-4">Nº Albarán</th>
                  <th className="px-6 py-4">Proveedor</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Base</th>
                  <th className="px-6 py-4">IVA</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Tipo Coste</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-6 font-mono text-sm text-slate-600">{row.delivery_num || '-'}</td>
                    <td className="px-6 font-medium text-slate-700">{row.vendor || '-'}</td>
                    <td className="px-6 text-slate-500">{row.date_delivery || '-'}</td>
                    <td className="px-6 text-slate-600">{formatCurrency(row.base)}</td>
                    <td className="px-6 text-slate-600">{formatCurrency(row.taxes)}</td>
                    <td className="px-6 font-semibold text-orange-600">{formatCurrency(row.total)}</td>
                    <td className="px-6 text-slate-500">{row.cost_type || '-'}</td>
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
