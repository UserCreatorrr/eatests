'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { ESTADO_ALBARAN, eur, fecha, hoyIso } from '@/lib/format'
import { Badge, Btn, Chip, Empty, Field, Input, Loading, Modal, Page, Panel, Select, Table, Td, Tr } from '@/components/ui'

const TONE: Record<string, 'ok' | 'warn' | 'crit' | 'neutral' | 'info'> = { draft: 'neutral', review: 'warn', validated: 'ok', invoiced: 'info' }

export default function AlbaranesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ supplierId: '', number: '', deliveryDate: hoyIso(), base: '', vat: '', total: '' })
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const [d, s] = await Promise.all([api.get('/api/delivery-notes'), api.get('/api/suppliers')]); setRows(d.data); setSuppliers(s.data) } catch (e) { setMsg(errorMessage(e)) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function create() {
    setSaving(true); setMsg('')
    try {
      const dn = await api.post('/api/delivery-notes', { supplierId: Number(form.supplierId), number: form.number || null, deliveryDate: form.deliveryDate, base: form.base === '' ? null : Number(form.base), vat: form.vat === '' ? null : Number(form.vat), total: form.total === '' ? null : Number(form.total) })
      router.push(`/dashboard/compras/albaranes/${dn.id}`)
    } catch (e) { setMsg(errorMessage(e)); setSaving(false) }
  }

  const visible = status ? rows.filter(r => r.status === status) : rows
  const count = (s: string) => rows.filter(r => r.status === s).length

  return (
    <Page eyebrow="Compras" title="Albaranes" subtitle="Hasta que un albarán se valida no actualiza precios ni stock. Validado o facturado, ya no se edita."
      actions={<><Btn kind="ghost" href="/dashboard/compras/escaneo">ESCANEAR</Btn><Btn onClick={() => { setMsg(''); setModal(true) }}>+ A MANO</Btn></>}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Chip active={status === ''} color={tk.iron} onClick={() => setStatus('')}>Todos · {rows.length}</Chip>
        {(['draft', 'review', 'validated', 'invoiced'] as const).map(s => <Chip key={s} active={status === s} color={s === 'review' ? tk.clay : s === 'validated' ? tk.appleDeep : tk.iron60} onClick={() => setStatus(s)}>{ESTADO_ALBARAN[s]} · {count(s)}</Chip>)}
      </div>
      <Panel>
        {loading ? <Loading /> : visible.length === 0 ? <Empty>Sin albaranes{status ? ' en este estado' : ''}.</Empty> : (
          <Table head={['Nº', 'Proveedor', 'Fecha', 'Líneas', 'Base', 'IVA', 'Total', 'Estado', 'Origen']} right={[3, 4, 5, 6]}>
            {visible.map(d => (
              <Tr key={d.id}>
                <Td><Link href={`/dashboard/compras/albaranes/${d.id}`} style={{ color: tk.appleDeep, fontWeight: 600, textDecoration: 'none' }}>{d.number}</Link></Td>
                <Td style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 12.5 }}>{d.supplier_name}</Td>
                <Td>{fecha(d.delivery_date)}</Td><Td right>{d.line_count}</Td>
                <Td right>{eur(d.base_cents / 100)}</Td><Td right>{eur(d.vat_cents / 100)}</Td><Td right style={{ fontWeight: 600 }}>{eur(d.total_cents / 100)}</Td>
                <Td><Badge tone={TONE[d.status]}>{ESTADO_ALBARAN[d.status]}</Badge></Td>
                <Td style={{ color: tk.iron60 }}>{d.source}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </Panel>
      {modal && (
        <Modal title="Nuevo albarán" onClose={() => setModal(false)} width={480}>
          <Field label="Proveedor *"><Select value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))} autoFocus><option value="">— elegir —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Nº albarán" hint="Vacío = automático"><Input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} /></Field>
            <Field label="Fecha de entrega"><Input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Base (€)"><Input type="number" step="0.01" value={form.base} onChange={e => setForm(f => ({ ...f, base: e.target.value }))} /></Field>
            <Field label="IVA (€)"><Input type="number" step="0.01" value={form.vat} onChange={e => setForm(f => ({ ...f, vat: e.target.value }))} /></Field>
            <Field label="Total (€)"><Input type="number" step="0.01" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} /></Field>
          </div>
          {msg && <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.terra, margin: '14px 0 0' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}><Btn kind="ghost" onClick={() => setModal(false)}>CANCELAR</Btn><Btn onClick={create} disabled={saving || !form.supplierId}>CREAR Y AÑADIR LÍNEAS</Btn></div>
        </Modal>
      )}
    </Page>
  )
}
