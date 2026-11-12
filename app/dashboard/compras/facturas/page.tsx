'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { ESTADO_FACTURA, diasHasta, eur, fecha, hoyIso } from '@/lib/format'
import { Badge, Btn, Chip, Empty, Field, Input, Loading, Modal, Page, Panel, Select, Stat, Table, Td, Tr } from '@/components/ui'

function dueBadge(f: any) {
  if (f.status === 'paid') return <Badge tone="ok">Pagada</Badge>
  const d = diasHasta(f.due_date)
  if (d == null) return <Badge>Pendiente</Badge>
  if (d < 0) return <Badge tone="crit">Vencida {Math.abs(d)}d</Badge>
  if (d === 0) return <Badge tone="warn">Vence hoy</Badge>
  if (d <= 7) return <Badge tone="warn">Vence en {d}d</Badge>
  return <Badge>Pendiente</Badge>
}

export default function FacturasPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'' | 'pending' | 'overdue' | 'paid'>('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ supplierId: '', number: '', invoiceDate: hoyIso(), dueDate: '', base: '', vat: '', total: '' })
  const [candidates, setCandidates] = useState<any[]>([])
  const [picked, setPicked] = useState<number[]>([])
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const [i, s] = await Promise.all([api.get('/api/invoices'), api.get('/api/suppliers')]); setRows(i.data); setSuppliers(s.data) } catch (e) { setMsg(errorMessage(e)) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!form.supplierId) { setCandidates([]); setPicked([]); return }
    api.get(`/api/delivery-notes?supplierId=${form.supplierId}&unbilled=1`).then(r => { setCandidates(r.data); setPicked([]) }).catch(() => setCandidates([]))
  }, [form.supplierId])

  const sumPicked = candidates.filter(c => picked.includes(c.id)).reduce((s, c) => ({ base: s.base + c.base_cents / 100, vat: s.vat + c.vat_cents / 100, total: s.total + c.total_cents / 100 }), { base: 0, vat: 0, total: 0 })

  async function create() {
    setSaving(true); setMsg('')
    try {
      const inv = await api.post('/api/invoices', { supplierId: Number(form.supplierId), number: form.number, invoiceDate: form.invoiceDate, dueDate: form.dueDate || null, base: form.base === '' ? null : Number(form.base), vat: form.vat === '' ? null : Number(form.vat), total: form.total === '' ? null : Number(form.total), deliveryNoteIds: picked })
      router.push(`/dashboard/compras/facturas/${inv.id}`)
    } catch (e) { setMsg(errorMessage(e)); setSaving(false) }
  }
  async function pay(f: any, paid: boolean) { try { await api.post(`/api/invoices/${f.id}/paid`, { paid }); await load() } catch (e) { alert(errorMessage(e)) } }

  const today = hoyIso()
  const visible = rows.filter(r => filter === '' ? true : filter === 'paid' ? r.status === 'paid' : filter === 'overdue' ? r.status === 'pending' && r.due_date && r.due_date < today : r.status === 'pending')
  const pending = rows.filter(r => r.status === 'pending'), overdue = pending.filter(r => r.due_date && r.due_date < today)
  const sum = (xs: any[]) => xs.reduce((s, x) => s + x.total_cents, 0) / 100

  return (
    <Page eyebrow="Compras" title="Facturas" subtitle="La factura es la verdad contable del gasto. Agrupa los albaranes validados del proveedor." actions={<><Btn kind="ghost" href="/dashboard/compras/escaneo">ESCANEAR</Btn><Btn onClick={() => { setMsg(''); setModal(true) }}>+ NUEVA</Btn></>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Stat label="Pendiente de pago" value={eur(sum(pending))} sub={`${pending.length} factura(s)`} tone={pending.length ? 'warn' : 'ok'} />
        <Stat label="Vencido" value={eur(sum(overdue))} sub={`${overdue.length} factura(s)`} tone={overdue.length ? 'crit' : 'ok'} />
        <Stat label="Total registrado" value={eur(sum(rows))} sub={`${rows.length} factura(s)`} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Chip active={filter === ''} color={tk.iron} onClick={() => setFilter('')}>Todas · {rows.length}</Chip>
        <Chip active={filter === 'pending'} color={tk.clay} onClick={() => setFilter('pending')}>Pendientes · {pending.length}</Chip>
        <Chip active={filter === 'overdue'} color={tk.terra} onClick={() => setFilter('overdue')}>Vencidas · {overdue.length}</Chip>
        <Chip active={filter === 'paid'} color={tk.appleDeep} onClick={() => setFilter('paid')}>Pagadas · {rows.length - pending.length}</Chip>
      </div>
      <Panel>
        {loading ? <Loading /> : visible.length === 0 ? <Empty>Sin facturas.</Empty> : (
          <Table head={['Nº', 'Proveedor', 'Fecha', 'Vence', 'Albaranes', 'Base', 'IVA', 'Total', 'Estado', '']} right={[4, 5, 6, 7]}>
            {visible.map(f => (
              <Tr key={f.id}>
                <Td><Link href={`/dashboard/compras/facturas/${f.id}`} style={{ color: tk.appleDeep, fontWeight: 600, textDecoration: 'none' }}>{f.number}</Link></Td>
                <Td style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 12.5 }}>{f.supplier_name}</Td>
                <Td>{fecha(f.invoice_date)}</Td><Td>{fecha(f.due_date)}</Td>
                <Td right>{f.delivery_note_count ?? '—'}</Td>
                <Td right>{eur(f.base_cents / 100)}</Td><Td right>{eur(f.vat_cents / 100)}</Td><Td right style={{ fontWeight: 600 }}>{eur(f.total_cents / 100)}</Td>
                <Td>{dueBadge(f)}</Td>
                <Td right>{f.status === 'pending' ? <Btn small onClick={() => pay(f, true)}>PAGADA</Btn> : <Btn small kind="ghost" onClick={() => pay(f, false)}>DESHACER</Btn>}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </Panel>
      {modal && (
        <Modal title="Nueva factura" onClose={() => setModal(false)} width={560}>
          <Field label="Proveedor *"><Select value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))} autoFocus><option value="">— elegir —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Nº factura *"><Input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} /></Field>
            <Field label="Fecha"><Input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} /></Field>
            <Field label="Vencimiento"><Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></Field>
          </div>
          {candidates.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <label style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: tk.iron40, display: 'block', marginBottom: 6 }}>Albaranes validados sin facturar</label>
              <div style={{ border: `1px solid ${tk.iron20}`, maxHeight: 180, overflowY: 'auto' }}>
                {candidates.map(c => (
                  <label key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 10px', borderBottom: `1px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 11.5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={picked.includes(c.id)} onChange={e => setPicked(p => e.target.checked ? [...p, c.id] : p.filter(x => x !== c.id))} />
                    <span style={{ flex: 1 }}>{c.number} · {fecha(c.delivery_date)}</span><span>{eur(c.total_cents / 100)}</span>
                  </label>
                ))}
              </div>
              {picked.length > 0 && <div style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, marginTop: 6 }}>Suma: base {eur(sumPicked.base)} · IVA {eur(sumPicked.vat)} · total {eur(sumPicked.total)} <button onClick={() => setForm(f => ({ ...f, base: sumPicked.base.toFixed(2), vat: sumPicked.vat.toFixed(2), total: sumPicked.total.toFixed(2) }))} style={{ marginLeft: 6, fontFamily: ff.mono, fontSize: 10.5, background: 'transparent', border: `1px solid ${tk.iron40}`, cursor: 'pointer', padding: '1px 6px' }}>usar</button></div>}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Base (€)"><Input type="number" step="0.01" value={form.base} onChange={e => setForm(f => ({ ...f, base: e.target.value }))} /></Field>
            <Field label="IVA (€)"><Input type="number" step="0.01" value={form.vat} onChange={e => setForm(f => ({ ...f, vat: e.target.value }))} /></Field>
            <Field label="Total (€)"><Input type="number" step="0.01" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} /></Field>
          </div>
          {msg && <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.terra, margin: '14px 0 0' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}><Btn kind="ghost" onClick={() => setModal(false)}>CANCELAR</Btn><Btn onClick={create} disabled={saving || !form.supplierId || !form.number}>GUARDAR</Btn></div>
        </Modal>
      )}
    </Page>
  )
}
