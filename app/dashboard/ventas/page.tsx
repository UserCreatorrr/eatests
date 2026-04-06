export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { requireServerUser } from '@/lib/auth'
import db from '@/lib/db'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

type Factura = { id: number; invoice_num: string | null; customer: string | null; date_invoice: string | null; total: number | null }

export default async function VentasPage() {
  const user = await requireServerUser()
  const deliveries = (db.prepare('SELECT COUNT(*) as n FROM albaranes_venta WHERE user_id = ?').get(user.id) as { n: number }).n
  const invoices = (db.prepare('SELECT COUNT(*) as n FROM facturas_venta WHERE user_id = ?').get(user.id) as { n: number }).n
  const recentFacturas = db.prepare('SELECT id, invoice_num, customer, date_invoice, total FROM facturas_venta WHERE user_id = ? ORDER BY date_invoice DESC LIMIT 10').all(user.id) as Factura[]

  const sections = [
    { label: 'Albaranes', count: deliveries, href: '/dashboard/ventas/albaranes' },
    { label: 'Facturas', count: invoices, href: '/dashboard/ventas/facturas' },
  ]

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Ventas</h1>
        <p className="page-subtitle">Gestion de albaranes y facturas de venta</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 32 }}>
        {sections.map(s => (
          <Link key={s.href} href={s.href} className="stat-card" style={{ textDecoration: 'none', display: 'block' }}>
            <p style={{ fontFamily: 'Chillax,sans-serif', fontSize: 36, fontWeight: 600, color: '#3d3834', marginBottom: 4 }}>{s.count.toLocaleString('es-ES')}</p>
            <p style={{ fontFamily: 'DM Mono,monospace', fontSize: 13, color: '#3d3834', opacity: 0.6 }}>{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="table-wrap">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span className="page-title" style={{ fontSize: '1rem' }}>Ultimas facturas de venta</span>
        </div>
        {recentFacturas.length === 0 ? (
          <div className="empty-state"><p className="page-subtitle">Sin datos importados</p></div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Nº Factura</th><th>Cliente</th><th>Fecha</th><th>Total</th></tr></thead>
            <tbody>
              {recentFacturas.map(f => (
                <tr key={f.id}>
                  <td className="col-mono">{f.invoice_num || '-'}</td>
                  <td className="col-main">{f.customer || '-'}</td>
                  <td>{f.date_invoice || '-'}</td>
                  <td className="col-amount">{formatCurrency(f.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
