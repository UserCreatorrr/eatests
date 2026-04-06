export const dynamic = 'force-dynamic'

import { requireServerUser } from '@/lib/auth'
import db from '@/lib/db'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

type Row = {
  id: number; num_order: string | null; vendor: string | null; code_vendor: string | null
  nif: string | null; date_order: string | null; date_reception: string | null
  sent_by: string | null; total: number | null
}

export default async function PedidosCompraPage() {
  const user = await requireServerUser()
  const rows = db.prepare('SELECT * FROM pedidos_compra WHERE user_id = ? ORDER BY date_order DESC').all(user.id) as Row[]

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Pedidos de Compra</h1>
        <p className="page-subtitle">{rows.length.toLocaleString('es-ES')} pedidos</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state"><p className="page-subtitle">Sin pedidos importados.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nº Pedido</th><th>Proveedor</th><th>NIF</th>
                  <th>Fecha Pedido</th><th>Fecha Recepcion</th><th>Enviado por</th><th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="col-mono">{row.num_order || '-'}</td>
                    <td className="col-main">{row.vendor || '-'}</td>
                    <td className="col-mono">{row.nif || '-'}</td>
                    <td>{row.date_order || '-'}</td>
                    <td>{row.date_reception || '-'}</td>
                    <td>{row.sent_by || '-'}</td>
                    <td className="col-amount">{formatCurrency(row.total)}</td>
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
