import { supabaseAdmin } from '@/lib/supabase'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

const formatDate = (v: string | null) => v ? new Date(v).toLocaleDateString('es-ES') : '-'

async function getData() {
  const { data, count } = await supabaseAdmin
    .from('tspoonlab_pedidos_compra')
    .select('id, migration_id, num_order, id_vendor, vendor, code_vendor, nif, date_order, date_formatted, date_reception, date_reception_formatted, sent_by, total', { count: 'exact' })
    .order('date_order', { ascending: false })
    .limit(1000)

  return { rows: data || [], count: count || 0 }
}

export default async function PedidosCompraPage() {
  const { rows, count } = await getData()

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Pedidos de Compra</h1>
        <p className="page-subtitle">{count.toLocaleString('es-ES')} pedidos</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-brand-dark/40">
            <svg className="w-12 h-12 mx-auto mb-3 text-brand-dark/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <th className="px-6 py-4">Cód.Proveedor</th>
                  <th className="px-6 py-4">NIF</th>
                  <th className="px-6 py-4">Fecha Pedido</th>
                  <th className="px-6 py-4">Fecha Recepción</th>
                  <th className="px-6 py-4">Enviado por</th>
                  <th className="px-6 py-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-brand-bg">
                    <td className="px-6 col-mono">{row.num_order || '-'}</td>
                    <td className="px-6 col-main">{row.vendor || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.code_vendor || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.nif || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{formatDate(row.date_order)}</td>
                    <td className="px-6 text-brand-dark/70">{formatDate(row.date_reception)}</td>
                    <td className="px-6 text-brand-dark/70">{row.sent_by || '-'}</td>
                    <td className="px-6 col-amount">{formatCurrency(row.total)}</td>
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
