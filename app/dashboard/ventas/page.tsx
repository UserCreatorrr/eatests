'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { tk } from '@/lib/design'
import { eur, fecha } from '@/lib/format'
import { Badge, Empty, Loading, Page, Panel, Stat, Table, Td, Tr } from '@/components/ui'

export default function VentasPage() {
  const [rows, setRows] = useState<any[] | null>(null)
  useEffect(() => { api.get('/api/sales-documents').then(r => setRows(r.data)).catch(() => setRows([])) }, [])
  if (!rows) return <Loading />
  const notes = rows.filter(r => r.kind === 'delivery_note'), invoices = rows.filter(r => r.kind === 'invoice')
  return (
    <Page eyebrow="Analytics" title="Ventas" subtitle="Albaranes y facturas emitidas. Las ventas por franja para labor y productividad se cargan en Labor › Horarios.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Link href="/dashboard/ventas/albaranes" style={{ textDecoration: 'none' }}><Stat label="Albaranes de venta" value={notes.length} /></Link>
        <Link href="/dashboard/ventas/facturas" style={{ textDecoration: 'none' }}><Stat label="Facturas de venta" value={invoices.length} sub={`${invoices.filter(i => !i.paid).length} sin cobrar`} /></Link>
        <Stat label="Facturado" value={eur(invoices.reduce((s, i) => s + i.total, 0))} />
      </div>
      <Panel title="Últimas facturas de venta">
        {invoices.length === 0 ? <Empty>Sin facturas de venta.</Empty> : (
          <Table head={['Nº', 'Cliente', 'Fecha', 'Total', 'Cobro']} right={[3]}>
            {invoices.slice(0, 10).map(f => <Tr key={f.id}><Td>{f.number || '—'}</Td><Td>{f.customer_name || '—'}</Td><Td>{fecha(f.doc_date)}</Td><Td right>{eur(f.total)}</Td><Td><Badge tone={f.paid ? 'ok' : 'warn'}>{f.paid ? 'Cobrada' : 'Pendiente'}</Badge></Td></Tr>)}
          </Table>
        )}
      </Panel>
      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: tk.iron40 }}>Registro simple: no llevan líneas ni afectan al stock.</p>
    </Page>
  )
}
