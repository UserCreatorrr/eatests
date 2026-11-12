'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { ESTADO_FACTURA, eur, fecha } from '@/lib/format'
import { Badge, Empty, Loading, Page, Panel, Stat, Table, Td, Tr } from '@/components/ui'

export default function ComprasPage() {
  const [d, setD] = useState<any>(null)
  const [counts, setCounts] = useState<{ orders: number; notes: number; review: number; invoices: number } | null>(null)
  const [recent, setRecent] = useState<any[]>([])
  useEffect(() => {
    Promise.all([api.get('/api/analytics/dashboard'), api.get('/api/orders'), api.get('/api/delivery-notes'), api.get('/api/invoices')]).then(([dash, o, n, i]) => {
      setD(dash); setCounts({ orders: o.data.length, notes: n.data.length, review: n.data.filter((x: any) => x.status === 'draft' || x.status === 'review').length, invoices: i.data.length }); setRecent(i.data.slice(0, 10))
    }).catch(() => setD({}))
  }, [])
  if (!d || !counts) return <Loading />
  return (
    <Page eyebrow="Food cost" title="Compras" subtitle="Pedidos, albaranes y facturas. El gasto se calcula sobre facturas; los albaranes mueven precios y stock al validarse.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Link href="/dashboard/compras/pedidos" style={{ textDecoration: 'none' }}><Stat label="Pedidos" value={counts.orders} /></Link>
        <Link href="/dashboard/compras/albaranes" style={{ textDecoration: 'none' }}><Stat label="Albaranes" value={counts.notes} sub={counts.review ? `${counts.review} sin validar` : 'todos validados'} tone={counts.review ? 'warn' : undefined} /></Link>
        <Link href="/dashboard/compras/facturas" style={{ textDecoration: 'none' }}><Stat label="Facturas" value={counts.invoices} sub={d.invoiceStats ? `${d.invoiceStats.pending} pendientes · ${eur(d.invoiceStats.pendingAmount)}` : undefined} tone={d.invoiceStats?.pending ? 'warn' : undefined} /></Link>
        <Stat label="Gasto este mes" value={eur(d.kpis?.spendThisMonth)} sub={d.kpis ? `mes anterior ${eur(d.kpis.spendLastMonth)}` : undefined} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link href="/dashboard/compras/escaneo" style={{ padding: '10px 18px', background: tk.apple, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: tk.iron, letterSpacing: '0.06em', textDecoration: 'none' }}>ESCANEAR ALBARÁN O FACTURA →</Link>
        <Link href="/dashboard/compras/pedidos?nuevo=1" style={{ padding: '10px 18px', background: tk.paper, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: tk.iron, letterSpacing: '0.06em', textDecoration: 'none' }}>NUEVO PEDIDO</Link>
      </div>
      <Panel title="Últimas facturas de compra">
        {recent.length === 0 ? <Empty>Sin facturas todavía.</Empty> : (
          <Table head={['Nº', 'Proveedor', 'Fecha', 'Vence', 'Total', 'Estado']} right={[4]}>
            {recent.map(f => <Tr key={f.id}><Td><Link href={`/dashboard/compras/facturas/${f.id}`} style={{ color: tk.appleDeep, fontWeight: 600, textDecoration: 'none' }}>{f.number}</Link></Td><Td>{f.supplier_name}</Td><Td>{fecha(f.invoice_date)}</Td><Td>{fecha(f.due_date)}</Td><Td right>{eur(f.total_cents / 100)}</Td><Td><Badge tone={f.status === 'paid' ? 'ok' : 'warn'}>{ESTADO_FACTURA[f.status]}</Badge></Td></Tr>)}
          </Table>
        )}
      </Panel>
    </Page>
  )
}
