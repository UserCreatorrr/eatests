export const dynamic = 'force-dynamic'

import { requireServerUser } from '@/lib/auth'
import db from '@/lib/db'

type Row = {
  id: number; codi: string | null; descr: string | null; nif: string | null
  mail_cc: string | null; web: string | null; creditor: string | null
  address: string | null; city: string | null; cp: string | null; comment: string | null
}

export default async function ProveedoresDetallePage() {
  const user = await requireServerUser()
  const rows = db.prepare('SELECT * FROM proveedores_detalle WHERE user_id = ? ORDER BY descr').all(user.id) as Row[]

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Detalles de Proveedores</h1>
        <p className="page-subtitle">{rows.length.toLocaleString('es-ES')} registros</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state">
            <p className="page-subtitle">Sin datos importados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Codigo</th><th>Nombre</th><th>NIF</th>
                  <th>Email</th><th>Web</th><th>Ciudad</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="col-mono">{row.codi || '-'}</td>
                    <td className="col-main">{row.descr || '-'}</td>
                    <td className="col-mono">{row.nif || '-'}</td>
                    <td>{row.mail_cc || '-'}</td>
                    <td>{row.web || '-'}</td>
                    <td>{[row.city, row.cp].filter(Boolean).join(' ') || '-'}</td>
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
