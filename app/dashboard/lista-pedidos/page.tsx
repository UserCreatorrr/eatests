import { supabaseAdmin } from '@/lib/supabase'

async function getData() {
  const { data, count } = await supabaseAdmin
    .from('tspoonlab_lista_pedidos')
    .select('id, descr, year, month, pending_send, pending_receive', { count: 'exact' })
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(200)

  return { rows: data || [], count: count || 0 }
}

const MONTH_NAMES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
}

export default async function ListaPedidosPage() {
  const { rows, count } = await getData()

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Lista de Pedidos</h1>
        <p className="text-slate-500 mt-1">{count.toLocaleString('es-ES')} registros importados</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <p>Sin lista de pedidos importada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Año</th>
                  <th className="px-6 py-4">Mes</th>
                  <th className="px-6 py-4">Pendiente Envío</th>
                  <th className="px-6 py-4">Pendiente Recepción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-6 font-medium text-slate-800">{row.descr || '-'}</td>
                    <td className="px-6 text-slate-600">{row.year ?? '-'}</td>
                    <td className="px-6 text-slate-500">
                      {row.month ? (MONTH_NAMES[row.month] ?? row.month) : '-'}
                    </td>
                    <td className="px-6">
                      {row.pending_send != null ? (
                        <span className={`badge ${row.pending_send > 0 ? 'badge-red' : 'badge-green'}`}>
                          {row.pending_send}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6">
                      {row.pending_receive != null ? (
                        <span className={`badge ${row.pending_receive > 0 ? 'badge-red' : 'badge-green'}`}>
                          {row.pending_receive}
                        </span>
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
