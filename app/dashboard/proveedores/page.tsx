export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase'

async function getProveedores() {
  const { data } = await supabaseAdmin
    .from('tspoonlab_proveedores')
    .select('id, migration_id, codi, descr, descr_type, id_type, defecte, has_other')
    .order('descr')
    .limit(1000)

  return data || []
}

export default async function ProveedoresPage() {
  const proveedores = await getProveedores()

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Proveedores</h1>
        <p className="page-subtitle">{proveedores.length.toLocaleString('es-ES')} proveedores importados</p>
      </div>

      <div className="table-wrap">
        {proveedores.length === 0 ? (
          <div className="p-12 text-center text-brand-dark/40">
            <svg className="w-12 h-12 mx-auto mb-3 text-brand-dark/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p>No hay proveedores importados todavía</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-4">Código</th>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">NIF type</th>
                  <th className="px-6 py-4">Defecto</th>
                  <th className="px-6 py-4">Otros</th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((row) => (
                  <tr key={row.id} className="hover:bg-brand-bg">
                    <td className="px-6 col-mono">{row.codi || '-'}</td>
                    <td className="px-6 col-main">{row.descr || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.descr_type || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.id_type || '-'}</td>
                    <td className="px-6">
                      {row.defecte ? (
                        <span className="badge badge-green">Sí</span>
                      ) : (
                        <span className="badge badge-blue">No</span>
                      )}
                    </td>
                    <td className="px-6">
                      {row.has_other ? (
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
