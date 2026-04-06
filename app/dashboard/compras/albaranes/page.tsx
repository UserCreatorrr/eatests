export const dynamic = 'force-dynamic'

import { requireServerUser } from '@/lib/auth'
import db from '@/lib/db'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

type Row = {
  id: number; delivery_num: string | null; vendor: string | null; code_vendor: string | null
  nif: string | null; delivery_for: string | null; date_delivery: string | null
  sent_by: string | null; received_by: string | null; base: number | null
  taxes: number | null; total: number | null; cost_type: string | null; vendor_type: string | null
}

export default async function AlbaranesCompraPage() {
  const user = await requireServerUser()
  const rows = db.prepare('SELECT * FROM albaranes_compra WHERE user_id = ? ORDER BY date_delivery DESC').all(user.id) as Row[]

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Albaranes de Compra</h1>
        <p className="page-subtitle">{rows.length.toLocaleString('es-ES')} albaranes</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state"><p className="page-subtitle">Sin albaranes importados.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nº Albaran</th><th>Proveedor</th><th>Para</th>
                  <th>Fecha</th><th>Enviado por</th><th>Recibido por</th>
                  <th>Base</th><th>IVA</th><th>Total</th><th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="col-mono">{row.delivery_num || '-'}</td>
                    <td className="col-main">{row.vendor || '-'}</td>
                    <td>{row.delivery_for || '-'}</td>
                    <td>{row.date_delivery || '-'}</td>
                    <td>{row.sent_by || '-'}</td>
                    <td>{row.received_by || '-'}</td>
                    <td>{formatCurrency(row.base)}</td>
                    <td>{formatCurrency(row.taxes)}</td>
                    <td className="col-amount">{formatCurrency(row.total)}</td>
                    <td>{row.cost_type || '-'}</td>
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
