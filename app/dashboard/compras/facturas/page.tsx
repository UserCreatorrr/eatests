export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

const formatDate = (v: string | null) => v ? new Date(v).toLocaleDateString('es-ES') : '-'

async function getData() {
  const { data, count } = await supabaseAdmin
    .from('tspoonlab_facturas_compra')
    .select('id, migration_id, id_vendor, vendor, code_vendor, account_vendor, nif, invoice_num, document_num, paid, validated, comment, date_invoice, date_accounting, date_due, code_payment_type, total, base, taxes', { count: 'exact' })
    .order('date_invoice', { ascending: false })
    .limit(1000)

  return { rows: data || [], count: count || 0 }
}

export default async function FacturasCompraPage() {
  const { rows, count } = await getData()

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Facturas de Compra</h1>
        <p className="page-subtitle">{count.toLocaleString('es-ES')} facturas</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-brand-dark/40">
            <svg className="w-12 h-12 mx-auto mb-3 text-brand-dark/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <th className="px-6 py-4">Nº Doc</th>
                  <th className="px-6 py-4">Proveedor</th>
                  <th className="px-6 py-4">Cód.Proveedor</th>
                  <th className="px-6 py-4">NIF</th>
                  <th className="px-6 py-4">Cta.Contable</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Contabilización</th>
                  <th className="px-6 py-4">Vencimiento</th>
                  <th className="px-6 py-4">Pago</th>
                  <th className="px-6 py-4">Base</th>
                  <th className="px-6 py-4">IVA</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Pagada</th>
                  <th className="px-6 py-4">Validada</th>
                  <th className="px-6 py-4">Comentario</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-brand-bg">
                    <td className="px-6 col-mono">{row.invoice_num || '-'}</td>
                    <td className="px-6 col-mono">{row.document_num || '-'}</td>
                    <td className="px-6 col-main">{row.vendor || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.code_vendor || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.nif || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.account_vendor || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{formatDate(row.date_invoice)}</td>
                    <td className="px-6 text-brand-dark/70">{formatDate(row.date_accounting)}</td>
                    <td className="px-6 text-brand-dark/70">{formatDate(row.date_due)}</td>
                    <td className="px-6 text-brand-dark/70">{row.code_payment_type || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{formatCurrency(row.base)}</td>
                    <td className="px-6 text-brand-dark/70">{formatCurrency(row.taxes)}</td>
                    <td className="px-6 col-amount">{formatCurrency(row.total)}</td>
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
                    <td className="px-6 text-brand-dark/60 text-sm max-w-xs truncate">{row.comment || '-'}</td>
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
