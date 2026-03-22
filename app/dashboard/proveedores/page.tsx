import { supabaseAdmin } from '@/lib/supabase'

async function getProveedores() {
  const { data } = await supabaseAdmin
    .from('tspoonlab_proveedores')
    .select('id, codi, descr, descr_type, defecte')
    .order('descr')
    .limit(500)

  return data || []
}

export default async function ProveedoresPage() {
  const proveedores = await getProveedores()

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Proveedores</h1>
        <p className="text-slate-500 mt-1">{proveedores.length.toLocaleString('es-ES')} proveedores importados</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {proveedores.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <th className="px-6 py-4">Defecto</th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-6 font-mono text-sm text-slate-500">{row.codi || '-'}</td>
                    <td className="px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 text-blue-700 font-bold text-sm">
                          {row.descr?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="font-medium text-slate-800">{row.descr || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 text-slate-500">{row.descr_type || '-'}</td>
                    <td className="px-6">
                      {row.defecte ? (
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
