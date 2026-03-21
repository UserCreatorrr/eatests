interface Column {
  key: string
  label: string
  format?: (value: unknown, row: Record<string, unknown>) => React.ReactNode
}

interface DataTableProps {
  title: string
  count: number
  columns: Column[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: Record<string, any>[]
  emptyMessage?: string
}

function formatDate(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('es-ES')
}

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    processed: 'badge-green',
    accounted: 'badge-green',
    pending: 'badge-yellow',
    received: 'badge-blue',
    invoiced: 'badge-blue',
    sent: 'badge-gray',
  }
  return (
    <span className={`badge ${map[status] || 'badge-gray'}`}>
      {status || 'pendiente'}
    </span>
  )
}

export { formatDate, formatCurrency, StatusBadge }
export type { Column }

export default function DataTable({ title, count, columns, rows, emptyMessage }: DataTableProps) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-slate-500 mt-1">{count.toLocaleString('es-ES')} registros</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p>{emptyMessage || 'Sin datos importados todavía'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className="px-6 py-4">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    {columns.map((col) => (
                      <td key={col.key} className="px-6">
                        {col.format ? col.format(row[col.key], row) : (row[col.key] ?? '-')}
                      </td>
                    ))}
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
