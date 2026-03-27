export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

async function getData() {
  const { data, count } = await supabaseAdmin
    .from('tspoonlab_ingredientes')
    .select('id, migration_id, codi, descr, type, has_data, id_unit, unit, cost, color', { count: 'exact' })
    .order('descr')
    .limit(1000)

  return { rows: data || [], count: count || 0 }
}

export default async function IngredientesPage() {
  const { rows, count } = await getData()

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Ingredientes</h1>
        <p className="page-subtitle">{count.toLocaleString('es-ES')} ingredientes importados</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-brand-dark/40">
            <svg className="w-12 h-12 mx-auto mb-3 text-brand-dark/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <p>Sin ingredientes importados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-4">Código</th>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Con datos</th>
                  <th className="px-6 py-4">Unidad</th>
                  <th className="px-6 py-4">ID Unidad</th>
                  <th className="px-6 py-4">Coste</th>
                  <th className="px-6 py-4">Color</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-brand-bg">
                    <td className="px-6 col-mono">{row.codi || '-'}</td>
                    <td className="px-6 col-main">{row.descr || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.type || '-'}</td>
                    <td className="px-6">
                      {row.has_data ? (
                        <span className="badge badge-green">Sí</span>
                      ) : (
                        <span className="badge badge-blue">No</span>
                      )}
                    </td>
                    <td className="px-6 text-brand-dark/70">{row.unit || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.id_unit ?? '-'}</td>
                    <td className="px-6 col-amount">{formatCurrency(row.cost)}</td>
                    <td className="px-6">
                      {row.color ? (
                        <span className="badge badge-blue">{row.color}</span>
                      ) : (
                        <span className="text-brand-dark/40">-</span>
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
