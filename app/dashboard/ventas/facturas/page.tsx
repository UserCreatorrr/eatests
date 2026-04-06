export const dynamic = 'force-dynamic'

import { requireServerUser } from '@/lib/auth'
import db from '@/lib/db'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

type Row = {
  id: number; invoice_num: string | null; document_num: string | null; customer: string | null
  code_customer: string | null; nif: string | null; account_customer: string | null
  date_invoice: string | null; date_due: string | null; code_payment_type: string | null
  base: number | null; taxes: number | null; total: number | null; paid: number | null; comment: string | null
}

export default async function FacturasVentaPage() {
  const user = await requireServerUser()
  const rows = db.prepare('SELECT * FROM facturas_venta WHERE user_id = ? ORDER BY date_invoice DESC').all(user.id) as Row[]

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Facturas de Venta</h1>
        <p className="page-subtitle">{rows.length.toLocaleString('es-ES')} facturas</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state"><p className="page-subtitle">Sin facturas importadas.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nº Factura</th><th>Nº Doc</th><th>Cliente</th><th>NIF</th>
                  <th>Fecha</th><th>Vencimiento</th><th>Base</th><th>IVA</th><th>Total</th><th>Pagada</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="col-mono">{row.invoice_num || '-'}</td>
                    <td className="col-mono">{row.document_num || '-'}</td>
                    <td className="col-main">{row.customer || '-'}</td>
                    <td className="col-mono">{row.nif || '-'}</td>
                    <td>{row.date_invoice || '-'}</td>
                    <td>{row.date_due || '-'}</td>
                    <td>{formatCurrency(row.base)}</td>
                    <td>{formatCurrency(row.taxes)}</td>
                    <td className="col-amount">{formatCurrency(row.total)}</td>
                    <td>{row.paid ? <span className="badge badge-green">Si</span> : <span className="badge badge-red">No</span>}</td>
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
