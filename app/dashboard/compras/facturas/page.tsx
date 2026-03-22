import { supabaseAdmin } from '@/lib/supabase'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

async function getData() {
  const { data, count } = await supabaseAdmin
    .from('tspoonlab_facturas_compra')
    .select('id, invoice_num, vendor, date_invoice, date_due, base, taxes, total, paid, validated', { count: 'exact' })
    .order('date_invoice', { ascending: false })
    .limit(500)

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
          <div className="p-12 text-center text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>Sin facturas de compra importadas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-4">Nº Factura</th>
                  <th className="px-6 py-4">Proveedor</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Vencimiento</th>
                  <th className="px-6 py-4">Base</th>
                  <th className="px-6 py-4">IVA</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Pagada</th>
                  <th className="px-6 py-4">Validada</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-6 font-mono text-sm text-slate-600">{row.invoice_num || '-'}</td>
                    <td className="px-6 font-medium text-slate-700">{row.vendor || '-'}</td>
                    <td className="px-6 text-slate-500">{row.date_invoice || '-'}</td>
                    <td className="px-6 text-slate-500">{row.date_due || '-'}</td>
                    <td className="px-6 text-slate-600">{formatCurrency(row.base)}</td>
                    <td className="px-6 text-slate-600">{formatCurrency(row.taxes)}</td>
                    <td className="px-6 font-semibold text-red-600">{formatCurrency(row.total)}</td>
                    <td className="px-6">
                      {row.paid ? (
                        <span className="badge badge-green">Sí</span>
                      ) : (
                        <span className="badge badge-red">No</span>
                      )}
                    </td>
                    <td className="px-6">
                      {row.validated ? (
                        <span className="badge badge-green">Sí</span>
                      ) : (
                        <span className="badge badge-blue">No</span>
                      )}
                    </td>
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
