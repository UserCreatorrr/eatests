'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { ESTADO_PEDIDO, eur, fecha } from '@/lib/format'
import { Badge, Btn, Chip, Empty, Field, Input, Loading, Modal, Page, Panel, Select, Table, Td, Tr } from '@/components/ui'

const TONE: Record<string, 'ok' | 'warn' | 'crit' | 'neutral' | 'info'> = { draft: 'neutral', sent: 'warn', received: 'info', closed: 'ok', cancelled: 'crit' }

export default function PedidosPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ supplierId: '', expectedDate: '', notes: '' })
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const [o, s] = await Promise.all([api.get('/api/orders'), api.get('/api/suppliers')]); setRows(o.data); setSuppliers(s.data) } catch (e) { setMsg(errorMessage(e)) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get('nuevo')
    if (n) { setForm(f => ({ ...f, supplierId: n !== '1' ? n : '' })); setModal(true) }
  }, [])

  async function create() {
    setSaving(true); setMsg('')
    try {
      const o = await api.post('/api/orders', { supplierId: Number(form.supplierId), expectedDate: form.expectedDate || null, notes: form.notes || null })
      router.push(`/dashboard/compras/pedidos/${o.id}`)
    } catch (e) { setMsg(errorMessage(e)); setSaving(false) }
  }

  const visible = status ? rows.filter(r => r.status === status) : rows
  const count = (s: string) => rows.filter(r => r.status === s).length

  return (
    <Page eyebrow="Compras" title="Pedidos" subtitle="Borrador → enviado → recibido (genera el albarán) → cerrado." actions={<Btn onClick={() => { setMsg(''); setModal(true) }}>+ NUEVO PEDIDO</Btn>}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Chip active={status === ''} color={tk.iron} onClick={() => setStatus('')}>Todos · {rows.length}</Chip>
        {(['draft', 'sent', 'received', 'closed', 'cancelled'] as const).map(s => <Chip key={s} active={status === s} color={s === 'sent' ? tk.clay : s === 'closed' ? tk.appleDeep : s === 'cancelled' ? tk.terra : tk.iron60} onClick={() => setStatus(s)}>{ESTADO_PEDIDO[s]} · {count(s)}</Chip>)}
      </div>
      <Panel>
        {loading ? <Loading /> : visible.length === 0 ? <Empty>Sin pedidos{status ? ' en este estado' : ''}.</Empty> : (
          <Table head={['Nº', 'Proveedor', 'Fecha', 'Entrega prevista', 'Líneas', 'Total estimado', 'Estado', 'Enviado']} right={[4, 5]}>
            {visible.map(o => (
              <Tr key={o.id}>
                <Td><Link href={`/dashboard/compras/pedidos/${o.id}`} style={{ color: tk.appleDeep, fontWeight: 600, textDecoration: 'none' }}>{o.number}</Link></Td>
                <Td style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 12.5 }}>{o.supplier_name}</Td>
                <Td>{fecha(o.order_date)}</Td><Td>{fecha(o.expected_date)}</Td>
                <Td right>{o.line_count}</Td><Td right>{eur(o.total)}</Td>
                <Td><Badge tone={TONE[o.status]}>{ESTADO_PEDIDO[o.status]}</Badge></Td>
                <Td style={{ color: tk.iron60 }}>{o.sent_via ? `${o.sent_via} · ${fecha(o.sent_at)}` : '—'}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </Panel>
      {modal && (
        <Modal title="Nuevo pedido" onClose={() => setModal(false)} width={440}>
          <Field label="Proveedor *"><Select value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))} autoFocus><option value="">— elegir —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Entrega prevista"><Input type="date" value={form.expectedDate} onChange={e => setForm(f => ({ ...f, expectedDate: e.target.value }))} /></Field>
            <Field label="Notas"><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Field>
          </div>
          {msg && <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.terra, margin: '14px 0 0' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}><Btn kind="ghost" onClick={() => setModal(false)}>CANCELAR</Btn><Btn onClick={create} disabled={saving || !form.supplierId}>CREAR Y AÑADIR LÍNEAS</Btn></div>
        </Modal>
      )}
    </Page>
  )
}
