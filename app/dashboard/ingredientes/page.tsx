export const dynamic = 'force-dynamic'

import { requireServerUser } from '@/lib/auth'
import db from '@/lib/db'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

type Row = {
  id: number; codi: string | null; descr: string | null; type: string | null
  has_data: number | null; unit: string | null; id_unit: number | null
  cost: number | null; color: string | null
}

export default async function IngredientesPage() {
  const user = await requireServerUser()
  const rows = db.prepare('SELECT * FROM ingredientes WHERE user_id = ? ORDER BY descr').all(user.id) as Row[]
  const count = rows.length

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Ingredientes</h1>
        <p className="page-subtitle">{count.toLocaleString('es-ES')} ingredientes importados</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state">
            <p className="page-subtitle">Sin ingredientes importados. Ejecuta la migracion desde Ajustes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Codigo</th><th>Nombre</th><th>Tipo</th>
                  <th>Con datos</th><th>Unidad</th><th>Coste</th><th>Color</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="col-mono">{row.codi || '-'}</td>
                    <td className="col-main">{row.descr || '-'}</td>
                    <td>{row.type || '-'}</td>
                    <td>
                      {row.has_data
                        ? <span className="badge badge-green">Si</span>
                        : <span className="badge badge-gray">No</span>}
                    </td>
                    <td>{row.unit || '-'}</td>
                    <td className="col-amount">{formatCurrency(row.cost)}</td>
                    <td>{row.color ? <span className="badge badge-blue">{row.color}</span> : '-'}</td>
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
