import { supabaseAdmin } from '@/lib/supabase'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

async function getData() {
  const { data, count } = await supabaseAdmin
    .from('tspoonlab_pedidos_compra')
    .select('id, num_order, vendor, date_order, date_reception, total, sent_by', { count: 'exact' })
    .order('date_order', { ascending: false })
    .limit(500)

  return { rows: data || [], count: count || 0 }
}

export default async function PedidosCompraPage() {
  const { rows, count } = await getData()

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pedidos de Compra</h1>
        <p className="text-slate-500 mt-1">{count.toLocaleString('es-ES')} pedidos</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>Sin pedidos de compra importados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-4">Nº Pedido</th>
                  <th className="px-6 py-4">Proveedor</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Fecha Recepción</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Enviado por</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-6 font-mono text-sm text-slate-600">{row.num_order || '-'}</td>
                    <td className="px-6 font-medium text-slate-700">{row.vendor || '-'}</td>
                    <td className="px-6 text-slate-500">{row.date_order || '-'}</td>
                    <td className="px-6 text-slate-500">{row.date_reception || '-'}</td>
                    <td className="px-6 font-semibold text-amber-600">{formatCurrency(row.total)}</td>
                    <td className="px-6 text-slate-500">{row.sent_by || '-'}</td>
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
