import { supabaseAdmin } from '@/lib/supabase'

const formatDate = (v: string | null) => v ? new Date(v).toLocaleDateString('es-ES') : '-'

const MONTH_NAMES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
}

async function getData() {
  const { data, count } = await supabaseAdmin
    .from('tspoonlab_lista_pedidos')
    .select('id, migration_id, descr, data, year, month, pending_send, pending_receive', { count: 'exact' })
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1000)

  return { rows: data || [], count: count || 0 }
}

export default async function ListaPedidosPage() {
  const { rows, count } = await getData()

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Lista de Pedidos</h1>
        <p className="page-subtitle">{count.toLocaleString('es-ES')} registros importados</p>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-brand-dark/40">
            <svg className="w-12 h-12 mx-auto mb-3 text-brand-dark/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Año</th>
                  <th className="px-6 py-4">Mes</th>
                  <th className="px-6 py-4">Pendiente Envío</th>
                  <th className="px-6 py-4">Pendiente Recepción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-brand-bg">
                    <td className="px-6 col-main">{row.descr || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{formatDate(row.data)}</td>
                    <td className="px-6 text-brand-dark/70">{row.year ?? '-'}</td>
                    <td className="px-6 text-brand-dark/70">
                      {row.month ? (MONTH_NAMES[row.month] ?? row.month) : '-'}
                    </td>
                    <td className="px-6">
                      {row.pending_send != null ? (
                        <span className={`badge ${row.pending_send > 0 ? 'badge-red' : 'badge-green'}`}>
                          {row.pending_send}
                        </span>
                      ) : (
                        <span className="text-brand-dark/40">-</span>
                      )}
                    </td>
                    <td className="px-6">
                      {row.pending_receive != null ? (
                        <span className={`badge ${row.pending_receive > 0 ? 'badge-red' : 'badge-green'}`}>
                          {row.pending_receive}
                        </span>
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
