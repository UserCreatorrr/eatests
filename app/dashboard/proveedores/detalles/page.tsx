export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase'

async function getData() {
  const { data, count } = await supabaseAdmin
    .from('tspoonlab_vendor_details')
    .select('id, migration_id, codi, descr, nif, comment, mail_cc, web, creditor, address, city, cp', { count: 'exact' })
    .order('descr')
    .limit(1000)

  return { rows: data || [], count: count || 0 }
}

export default async function VendorDetallesPage() {
  const { rows, count } = await getData()

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Detalles de Proveedores</h1>
        <p className="page-subtitle">{count.toLocaleString('es-ES')} registros importados</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-brand-dark/40">
            <svg className="w-12 h-12 mx-auto mb-3 text-brand-dark/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p>No hay detalles de proveedores importados todavía</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-4">Código</th>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">NIF</th>
                  <th className="px-6 py-4">Dirección</th>
                  <th className="px-6 py-4">Email CC</th>
                  <th className="px-6 py-4">Web</th>
                  <th className="px-6 py-4">Acreedor</th>
                  <th className="px-6 py-4">Comentario</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-brand-bg">
                    <td className="px-6 col-mono">{row.codi || '-'}</td>
                    <td className="px-6 col-main">{row.descr || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.nif || '-'}</td>
                    <td className="px-6 text-brand-dark/70 text-sm">
                      {[row.address, row.cp, row.city].filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="px-6 text-brand-dark/70">{row.mail_cc || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.web || '-'}</td>
                    <td className="px-6">
                      {row.creditor ? (
                        <span className="badge badge-green">Sí</span>
                      ) : (
                        <span className="badge badge-blue">No</span>
                      )}
                    </td>
                    <td className="px-6 text-brand-dark/60 text-sm max-w-xs truncate">{row.comment || '-'}</td>
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
