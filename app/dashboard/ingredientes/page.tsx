import { supabaseAdmin } from '@/lib/supabase'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

async function getData() {
  const { data, count } = await supabaseAdmin
    .from('tspoonlab_ingredientes')
    .select('id, codi, descr, type, unit, cost, color', { count: 'exact' })
    .order('descr')
    .limit(500)

  return { rows: data || [], count: count || 0 }
}

export default async function IngredientesPage() {
  const { rows, count } = await getData()

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Ingredientes</h1>
        <p className="text-slate-500 mt-1">{count.toLocaleString('es-ES')} ingredientes importados</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <th className="px-6 py-4">Unidad</th>
                  <th className="px-6 py-4">Coste</th>
                  <th className="px-6 py-4">Color</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-6 font-mono text-sm text-slate-500">{row.codi || '-'}</td>
                    <td className="px-6 font-medium text-slate-800">{row.descr || '-'}</td>
                    <td className="px-6 text-slate-500">{row.type || '-'}</td>
                    <td className="px-6 text-slate-500">{row.unit || '-'}</td>
                    <td className="px-6 font-semibold text-lime-700">{formatCurrency(row.cost)}</td>
                    <td className="px-6">
                      {row.color ? (
                        <span className="badge badge-blue">{row.color}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
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
