import { supabaseAdmin } from '@/lib/supabase'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

const formatDate = (v: string | null) => v ? new Date(v).toLocaleDateString('es-ES') : '-'

async function getData() {
  const { data, count } = await supabaseAdmin
    .from('tspoonlab_albaranes_venta')
    .select('id, migration_id, id_customer, customer, customer_code, customer_type, customer_type_code, nif, contact, phone, mail, address, cp, city, invoice_num, date_delivery, base', { count: 'exact' })
    .order('date_delivery', { ascending: false })
    .limit(1000)

  return { rows: data || [], count: count || 0 }
}

export default async function AlbaranesVentaPage() {
  const { rows, count } = await getData()

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-brand-dark">Albaranes de Venta</h1>
        <p className="text-sm font-mono text-brand-dark/50 mt-1">{count.toLocaleString('es-ES')} albaranes</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-brand-border overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-brand-dark/40">
            <svg className="w-12 h-12 mx-auto mb-3 text-brand-dark/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <p>Sin albaranes de venta importados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-4">Nº Albarán</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Código</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">NIF</th>
                  <th className="px-6 py-4">Contacto</th>
                  <th className="px-6 py-4">Teléfono</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Dirección</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Base</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-brand-bg">
                    <td className="px-6 font-mono text-sm text-brand-dark/70">{row.invoice_num || '-'}</td>
                    <td className="px-6 font-medium text-brand-dark">{row.customer || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.customer_code || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.customer_type || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.nif || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.contact || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.phone || '-'}</td>
                    <td className="px-6 text-brand-dark/70">{row.mail || '-'}</td>
                    <td className="px-6 text-brand-dark/70 text-sm">
                      {[row.address, row.cp, row.city].filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="px-6 text-brand-dark/70">{formatDate(row.date_delivery)}</td>
                    <td className="px-6 font-semibold text-brand-dark">{formatCurrency(row.base)}</td>
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
