export const dynamic = 'force-dynamic'

import { requireServerUser } from '@/lib/auth'
import db from '@/lib/db'

type Row = {
  id: number; codi: string | null; descr: string | null; descr_type: string | null
  id_type: number | null; defecte: number | null; has_other: number | null
}

export default async function ProveedoresPage() {
  const user = await requireServerUser()
  const rows = db.prepare('SELECT * FROM proveedores WHERE user_id = ? ORDER BY descr').all(user.id) as Row[]

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Proveedores</h1>
        <p className="page-subtitle">{rows.length.toLocaleString('es-ES')} proveedores importados</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state">
            <p className="page-subtitle">Sin proveedores importados. Ejecuta la migracion desde Ajustes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Codigo</th><th>Nombre</th><th>Tipo</th><th>Por defecto</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="col-mono">{row.codi || '-'}</td>
                    <td className="col-main">{row.descr || '-'}</td>
                    <td>{row.descr_type || '-'}</td>
                    <td>
                      {row.defecte
                        ? <span className="badge badge-green">Si</span>
                        : <span className="badge badge-gray">No</span>}
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
