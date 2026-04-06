export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { requireServerUser } from '@/lib/auth'
import db from '@/lib/db'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

type Factura = { id: number; invoice_num: string | null; vendor: string | null; date_invoice: string | null; total: number | null }

export default async function ComprasPage() {
  const user = await requireServerUser()
  const orders = (db.prepare('SELECT COUNT(*) as n FROM pedidos_compra WHERE user_id = ?').get(user.id) as { n: number }).n
  const deliveries = (db.prepare('SELECT COUNT(*) as n FROM albaranes_compra WHERE user_id = ?').get(user.id) as { n: number }).n
  const invoices = (db.prepare('SELECT COUNT(*) as n FROM facturas_compra WHERE user_id = ?').get(user.id) as { n: number }).n
  const recentFacturas = db.prepare('SELECT id, invoice_num, vendor, date_invoice, total FROM facturas_compra WHERE user_id = ? ORDER BY date_invoice DESC LIMIT 10').all(user.id) as Factura[]

  const sections = [
    { label: 'Pedidos', count: orders, href: '/dashboard/compras/pedidos' },
    { label: 'Albaranes', count: deliveries, href: '/dashboard/compras/albaranes' },
    { label: 'Facturas', count: invoices, href: '/dashboard/compras/facturas' },
  ]

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Compras</h1>
        <p className="page-subtitle">Gestion de pedidos, albaranes y facturas de compra</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 32 }}>
        {sections.map(s => (
          <Link key={s.href} href={s.href} className="stat-card" style={{ textDecoration: 'none', display: 'block' }}>
            <p style={{ fontFamily: 'Chillax,sans-serif', fontSize: 36, fontWeight: 600, color: '#3d3834', marginBottom: 4 }}>{s.count.toLocaleString('es-ES')}</p>
            <p style={{ fontFamily: 'DM Mono,monospace', fontSize: 13, color: '#3d3834', opacity: 0.6 }}>{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="table-wrap">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span className="page-title" style={{ fontSize: '1rem' }}>Ultimas facturas de compra</span>
        </div>
        {recentFacturas.length === 0 ? (
          <div className="empty-state"><p className="page-subtitle">Sin datos importados</p></div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Nº Factura</th><th>Proveedor</th><th>Fecha</th><th>Total</th></tr></thead>
            <tbody>
              {recentFacturas.map(f => (
                <tr key={f.id}>
                  <td className="col-mono">{f.invoice_num || '-'}</td>
                  <td className="col-main">{f.vendor || '-'}</td>
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
