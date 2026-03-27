import { supabaseAdmin } from '@/lib/supabase'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

const formatDate = (v: string | null) => v ? new Date(v).toLocaleDateString('es-ES') : '-'

async function getData() {
  const { data, count } = await supabaseAdmin
    .from('tspoonlab_albaranes_compra')
    .select('id, migration_id, id_vendor, vendor, code_vendor, account_vendor, nif, delivery_num, delivery_for, date_delivery, date_sent, sent_by, received_by, base, taxes, total, id_cost_type, cost_type, vendor_type', { count: 'exact' })
    .order('date_delivery', { ascending: false })
    .limit(1000)

  return { rows: data || [], count: count || 0 }
}

export default async function AlbaranesCompraPage() {
  const { rows, count } = await getData()

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Albaranes de Compra</h1>
        <p className="page-subtitle">{count.toLocaleString('es-ES')} albaranes</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-brand-dark/40">
            <svg className="w-12 h-12 mx-auto mb-3 text-brand-dark/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <th className="px-6 py-4">Cód.Proveedor</th>
                  <th className="px-6 py-4">NIF</th>
                  <th className="px-6 py-4">Para</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Fecha Envío</th>
                  <th className="px-6 py-4">Enviado por</th>
                  <th className="px-6 py-4">Recibido por</th>
                  <th className="px-6 py-4">Base</th>
                  <th className="px-6 py-4">IVA</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Tipo Coste</th>
                  <th className="px-6 py-4">Tipo Proveedor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-brand-bg">
                    <td className="px-6 col-mono">{row.delivery_num || '-'}</td>
                    <td className="px-6 col-main">{row.vendor || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.code_vendor || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.nif || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.delivery_for || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{formatDate(row.date_delivery)}</td>
                    <td className="px-6 text-brand-dark/70">{formatDate(row.date_sent)}</td>
                    <td className="px-6 text-brand-dark/70">{row.sent_by || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.received_by || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{formatCurrency(row.base)}</td>
                    <td className="px-6 text-brand-dark/70">{formatCurrency(row.taxes)}</td>
                    <td className="px-6 col-amount">{formatCurrency(row.total)}</td>
                    <td className="px-6 text-brand-dark/70">{row.cost_type || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.vendor_type || '-'}</td>
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
