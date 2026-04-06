export const dynamic = 'force-dynamic'

import { requireServerUser } from '@/lib/auth'
import db from '@/lib/db'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

type Row = {
  id: number; invoice_num: string | null; customer: string | null; customer_code: string | null
  customer_type: string | null; nif: string | null; contact: string | null
  phone: string | null; mail: string | null; address: string | null
  cp: string | null; city: string | null; date_delivery: string | null; base: number | null
}

export default async function AlbaranesVentaPage() {
  const user = await requireServerUser()
  const rows = db.prepare('SELECT * FROM albaranes_venta WHERE user_id = ? ORDER BY date_delivery DESC').all(user.id) as Row[]

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Albaranes de Venta</h1>
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
                  <th>Nº Albaran</th><th>Cliente</th><th>Tipo</th>
                  <th>NIF</th><th>Contacto</th><th>Ciudad</th><th>Fecha</th><th>Base</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="col-mono">{row.invoice_num || '-'}</td>
                    <td className="col-main">{row.customer || '-'}</td>
                    <td>{row.customer_type || '-'}</td>
                    <td className="col-mono">{row.nif || '-'}</td>
                    <td>{row.contact || '-'}</td>
                    <td>{[row.city, row.cp].filter(Boolean).join(' ') || '-'}</td>
                    <td>{row.date_delivery || '-'}</td>
                    <td className="col-amount">{formatCurrency(row.base)}</td>
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
