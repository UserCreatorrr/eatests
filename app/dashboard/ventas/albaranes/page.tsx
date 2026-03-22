import { supabaseAdmin } from '@/lib/supabase'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

async function getData() {
  const { data, count } = await supabaseAdmin
    .from('tspoonlab_albaranes_venta')
    .select('id, invoice_num, customer, customer_code, date_delivery, base, city', { count: 'exact' })
    .order('date_delivery', { ascending: false })
    .limit(500)

  return { rows: data || [], count: count || 0 }
}

export default async function AlbaranesVentaPage() {
  const { rows, count } = await getData()

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Albaranes de Venta</h1>
        <p className="text-slate-500 mt-1">{count.toLocaleString('es-ES')} albaranes</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <p>Sin albaranes de venta importados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-4">Nº Albarán</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Código</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Base</th>
                  <th className="px-6 py-4">Ciudad</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-6 font-mono text-sm text-slate-600">{row.invoice_num || '-'}</td>
                    <td className="px-6 font-medium text-slate-700">{row.customer || '-'}</td>
                    <td className="px-6 text-slate-500">{row.customer_code || '-'}</td>
                    <td className="px-6 text-slate-500">{row.date_delivery || '-'}</td>
                    <td className="px-6 text-slate-600">{formatCurrency(row.base)}</td>
                    <td className="px-6 text-slate-500">{row.city || '-'}</td>
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
