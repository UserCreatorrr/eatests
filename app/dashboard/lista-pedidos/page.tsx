export const dynamic = 'force-dynamic'

import { requireServerUser } from '@/lib/auth'
import db from '@/lib/db'

const MONTH_NAMES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
}

type Row = {
  id: number; descr: string | null; data: string | null; year: number | null
  month: number | null; pending_send: number | null; pending_receive: number | null
}

export default async function ListaPedidosPage() {
  const user = await requireServerUser()
  const rows = db.prepare('SELECT * FROM lista_pedidos WHERE user_id = ? ORDER BY year DESC, month DESC').all(user.id) as Row[]

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Lista de Pedidos</h1>
        <p className="page-subtitle">{rows.length.toLocaleString('es-ES')} registros</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state"><p className="page-subtitle">Sin lista de pedidos importada.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th><th>Fecha</th><th>Ano</th><th>Mes</th>
                  <th>Pendiente Envio</th><th>Pendiente Recepcion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="col-main">{row.descr || '-'}</td>
                    <td>{row.data || '-'}</td>
                    <td>{row.year ?? '-'}</td>
                    <td>{row.month ? (MONTH_NAMES[row.month] ?? row.month) : '-'}</td>
                    <td>
                      {row.pending_send != null
                        ? <span className={`badge ${row.pending_send > 0 ? 'badge-red' : 'badge-green'}`}>{row.pending_send}</span>
                        : '-'}
                    </td>
                    <td>
                      {row.pending_receive != null
                        ? <span className={`badge ${row.pending_receive > 0 ? 'badge-red' : 'badge-green'}`}>{row.pending_receive}</span>
                        : '-'}
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
