'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { ESTADO_ALBARAN, ESTADO_FACTURA, ESTADO_PEDIDO, eur, fecha } from '@/lib/format'
import { Badge, Btn, Delta, Empty, Loading, Page, Panel, Table, Td, Tr } from '@/components/ui'

export default function ProveedorFichaPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.get(`/api/suppliers/${id}`).then(setData).catch(e => setErr(errorMessage(e))) }, [id])

  if (err) return <div style={{ padding: 36, fontFamily: ff.mono, color: tk.terra }}>{err}</div>
  if (!data) return <Loading />
  const { supplier: p, ingredients, invoices, deliveryNotes, orders, prices, totals: t } = data

  return (
    <Page back={{ href: '/dashboard/proveedores', label: 'Proveedores' }} eyebrow="Ficha de proveedor" title={p.name}
      subtitle={<>{[p.tax_id && `NIF ${p.tax_id}`, p.contact_name, p.phone, p.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}{(p.address || p.city) && <><br />{[p.address, p.city, p.postal_code].filter(Boolean).join(', ')}</>}</>}
      actions={<Btn kind="ghost" href={`/dashboard/compras/pedidos?nuevo=${p.id}`}>HACER PEDIDO</Btn>}>
      <div style={{ background: tk.iron, color: tk.cream, padding: '18px 24px', marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        <Big label={t.invoices_cents > 0 ? 'Gasto facturado' : 'Gasto en albaranes'} value={eur(t.spend_cents / 100)} sub={t.invoices_cents > 0 ? (t.delivery_notes_cents > 0 ? `${eur(t.delivery_notes_cents / 100)} entregado en albaranes` : 'Suma de facturas') : t.delivery_notes_cents > 0 ? 'Aún sin facturas: albaranes validados' : 'Sin documentos de compra'} />
        <Big label="Pendiente de pago" value={eur(t.pending_cents / 100)} sub={`${invoices.filter((v: any) => v.status === 'pending').length} factura(s)`} warn={t.pending_cents > 0} />
        <Big label="Ingredientes" value={ingredients.length} />
        <Big label="Pedidos · Albaranes · Facturas" value={`${orders.length} · ${deliveryNotes.length} · ${invoices.length}`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <Panel title={`Ingredientes (${ingredients.length})`}>
          {ingredients.length === 0 ? <Empty>Sin ingredientes asignados.</Empty> : (
            <Table head={['Ingrediente', 'Coste']} right={[1]}>
              {ingredients.map((i: any) => <Tr key={i.id}><Td><Link href={`/dashboard/ingredientes/${i.id}`} style={{ color: tk.iron, textDecoration: 'none', borderBottom: `1px solid ${tk.iron40}` }}>{i.name}</Link></Td><Td right>{i.cost != null ? `${eur(i.cost)}/${i.base_unit}` : '—'}</Td></Tr>)}
            </Table>
          )}
        </Panel>
        <Panel title="Últimos precios">
          {prices.length === 0 ? <Empty>Sin histórico de precios.</Empty> : (
            <Table head={['Ingrediente', 'Fecha', 'Precio', 'Cambio']} right={[2, 3]}>
              {prices.map((u: any, i: number) => <Tr key={i}><Td>{u.name}</Td><Td>{fecha(u.observed_on)}</Td><Td right>{eur(u.unit_price)}</Td><Td right><Delta pct={u.previous_price > 0 ? Math.round(((u.unit_price - u.previous_price) / u.previous_price) * 1000) / 10 : null} /></Td></Tr>)}
            </Table>
          )}
        </Panel>
      </div>

      <Panel title={`Facturas (${invoices.length})`}>
        {invoices.length === 0 ? <Empty>Sin facturas registradas.</Empty> : (
          <Table head={['Nº', 'Fecha', 'Vence', 'Total', 'Estado']} right={[3]}>
            {invoices.map((f: any) => <Tr key={f.id}><Td><Link href={`/dashboard/compras/facturas/${f.id}`} style={{ color: tk.appleDeep, fontWeight: 600, textDecoration: 'none' }}>{f.number}</Link></Td><Td>{fecha(f.invoice_date)}</Td><Td>{fecha(f.due_date)}</Td><Td right>{eur(f.total_cents / 100)}</Td><Td><Badge tone={f.status === 'paid' ? 'ok' : 'warn'}>{ESTADO_FACTURA[f.status]}</Badge></Td></Tr>)}
          </Table>
        )}
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <Panel title={`Pedidos (${orders.length})`}>
          {orders.length === 0 ? <Empty>Sin pedidos.</Empty> : (
            <Table head={['Nº', 'Fecha', 'Estado', 'Total']} right={[3]}>
              {orders.map((o: any) => <Tr key={o.id}><Td><Link href={`/dashboard/compras/pedidos/${o.id}`} style={{ color: tk.appleDeep, fontWeight: 600, textDecoration: 'none' }}>{o.number}</Link></Td><Td>{fecha(o.order_date)}</Td><Td><Badge>{ESTADO_PEDIDO[o.status]}</Badge></Td><Td right>{eur(o.total)}</Td></Tr>)}
            </Table>
          )}
        </Panel>
        <Panel title={`Albaranes (${deliveryNotes.length})`}>
          {deliveryNotes.length === 0 ? <Empty>Sin albaranes.</Empty> : (
            <Table head={['Nº', 'Fecha', 'Estado', 'Total']} right={[3]}>
              {deliveryNotes.map((a: any) => <Tr key={a.id}><Td><Link href={`/dashboard/compras/albaranes/${a.id}`} style={{ color: tk.appleDeep, fontWeight: 600, textDecoration: 'none' }}>{a.number}</Link></Td><Td>{fecha(a.delivery_date)}</Td><Td><Badge tone={a.status === 'validated' || a.status === 'invoiced' ? 'ok' : 'warn'}>{ESTADO_ALBARAN[a.status]}</Badge></Td><Td right>{eur(a.total_cents / 100)}</Td></Tr>)}
            </Table>
          )}
        </Panel>
      </div>
      {p.notes && <Panel title="Notas"><div style={{ padding: 16, fontFamily: ff.mono, fontSize: 12, lineHeight: 1.6 }}>{p.notes}</div></Panel>}
    </Page>
  )
}

function Big({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) {
  return (
    <div>
      <p style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', opacity: 0.55, textTransform: 'uppercase', margin: 0 }}>{label}</p>
      <p style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 24, color: warn ? '#fca5a5' : tk.apple, margin: '4px 0 0' }}>{value}</p>
      {sub && <p style={{ fontFamily: ff.mono, fontSize: 10, opacity: 0.5, margin: '2px 0 0' }}>{sub}</p>}
    </div>
  )
}
