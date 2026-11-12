'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { ESTADO_ALBARAN, ESTADO_FACTURA, eur, fecha } from '@/lib/format'
import { Badge, Btn, Empty, Loading, Note, Page, Panel, Table, Td, Tr } from '@/components/ui'

export default function FacturaDetallePage() {
  const { id } = useParams<{ id: string }>()
  const [f, setF] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const load = useCallback(async () => { try { setF(await api.get(`/api/invoices/${id}`)) } catch (e) { setErr(errorMessage(e)) } }, [id])
  useEffect(() => { load() }, [load])
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setMsg(''); try { await fn(); await load() } catch (e) { setMsg(errorMessage(e)) } setBusy(false) }

  if (err) return <div style={{ padding: 36, fontFamily: ff.mono, color: tk.terra }}>{err}</div>
  if (!f) return <Loading />
  const notesSum = f.deliveryNotes.reduce((s: number, n: any) => s + n.total_cents, 0) / 100
  const total = f.total_cents / 100

  return (
    <Page back={{ href: '/dashboard/compras/facturas', label: 'Facturas' }} eyebrow="Factura de compra" title={f.number}
      subtitle={<><Link href={`/dashboard/proveedores/${f.supplier_id}`} style={{ color: tk.appleDeep, textDecoration: 'none', fontWeight: 600 }}>{f.supplier_name}</Link> · {fecha(f.invoice_date)}{f.due_date ? ` · vence ${fecha(f.due_date)}` : ''}{f.paid_on ? ` · pagada el ${fecha(f.paid_on)}` : ''}</>}
      actions={<><Badge tone={f.status === 'paid' ? 'ok' : 'warn'}>{ESTADO_FACTURA[f.status]}</Badge>{f.status === 'pending' ? <Btn onClick={() => run(() => api.post(`/api/invoices/${id}/paid`, { paid: true }))} disabled={busy}>MARCAR PAGADA</Btn> : <Btn kind="ghost" onClick={() => run(() => api.post(`/api/invoices/${id}/paid`, { paid: false }))} disabled={busy}>MARCAR PENDIENTE</Btn>}</>}>
      {msg && <Note tone="crit">{msg}</Note>}
      <div style={{ display: 'grid', gridTemplateColumns: f.image ? '1fr 300px' : '1fr', gap: 16, alignItems: 'start' }}>
        <div>
          <Panel title="Importes">
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, fontFamily: ff.mono, fontSize: 13 }}>
              <div><div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase' }}>Base</div>{eur(f.base_cents / 100)}</div>
              <div><div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase' }}>IVA</div>{eur(f.vat_cents / 100)}</div>
              <div><div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase' }}>Total</div><strong>{eur(total)}</strong></div>
              <div><div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase' }}>Albaranes</div><span style={{ color: f.deliveryNotes.length && Math.abs(notesSum - total) > 0.02 ? tk.clay : tk.iron }}>{eur(notesSum)}</span></div>
            </div>
          </Panel>
          <Panel title={`Albaranes agrupados · ${f.deliveryNotes.length}`}>
            {f.deliveryNotes.length === 0 ? <Empty>Esta factura no agrupa ningún albarán.</Empty> : (
              <Table head={['Nº', 'Fecha', 'Líneas', 'Total', 'Estado', '']} right={[2, 3]}>
                {f.deliveryNotes.map((n: any) => <Tr key={n.id}><Td><Link href={`/dashboard/compras/albaranes/${n.id}`} style={{ color: tk.appleDeep, fontWeight: 600, textDecoration: 'none' }}>{n.number}</Link></Td><Td>{fecha(n.delivery_date)}</Td><Td right>{n.line_count}</Td><Td right>{eur(n.total_cents / 100)}</Td><Td><Badge tone="info">{ESTADO_ALBARAN[n.status]}</Badge></Td><Td right><Btn small kind="danger" onClick={() => run(() => api.del(`/api/invoices/${id}/delivery-notes/${n.id}`))} disabled={busy}>QUITAR</Btn></Td></Tr>)}
              </Table>
            )}
          </Panel>
          {f.candidates.length > 0 && (
            <Panel title="Albaranes validados del proveedor sin facturar">
              <Table head={['Nº', 'Fecha', 'Total', '']} right={[2]}>
                {f.candidates.map((n: any) => <Tr key={n.id}><Td>{n.number}</Td><Td>{fecha(n.delivery_date)}</Td><Td right>{eur(n.total_cents / 100)}</Td><Td right><Btn small onClick={() => run(() => api.post(`/api/invoices/${id}/delivery-notes`, { deliveryNoteIds: [n.id] }))} disabled={busy}>AÑADIR</Btn></Td></Tr>)}
              </Table>
            </Panel>
          )}
        </div>
        {f.image && <Panel title="Documento original"><img src={f.image.data} alt="" style={{ width: '100%', display: 'block' }} /></Panel>}
      </div>
    </Page>
  )
}
