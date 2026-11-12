'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { eur, fecha, num } from '@/lib/format'
import { Btn, Empty, Field, Input, Loading, Modal, Note, Page, Panel, Select, Stat, Table, Td, Tr } from '@/components/ui'

type Level = { ingredient_id: number; name: string; base_unit: string; warehouse_id: number | null; warehouse_name: string | null; qty: number; value: number; last_movement: string }
type Warehouse = { id: number; name: string; kind: string; ingredients: number }
type Ing = { id: number; name: string; base_unit: string; cost: number | null; warehouse_id: number | null; warehouse_name: string | null; supplier_name: string | null; category: string | null }

const KIND: Record<string, string> = { refrigerated: 'Refrigerado', frozen: 'Congelado', dry: 'Seco', other: 'Otro' }

export default function AlmacenesPage() {
  const [levels, setLevels] = useState<Level[]>([])
  const [totalValue, setTotalValue] = useState(0)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [ings, setIngs] = useState<Ing[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stock' | 'ubicaciones'>('stock')
  const [modal, setModal] = useState<null | 'almacen' | 'ajuste' | 'recuento'>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [count, setCount] = useState<Record<number, string>>({})
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, w, i] = await Promise.all([api.get('/api/stock'), api.get('/api/warehouses'), api.get('/api/ingredients')])
      setLevels(s.data); setTotalValue(s.totalValue); setWarehouses(w.data); setIngs(i.data)
    } catch (e) { setMsg(errorMessage(e)) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function submit() {
    setSaving(true); setMsg('')
    try {
      if (modal === 'almacen') await api.post('/api/warehouses', { name: form.name, kind: form.kind || 'other' })
      if (modal === 'ajuste') await api.post('/api/stock/adjustments', { ingredientId: Number(form.ingredientId), qty: Number(form.qty), unit: form.unit, note: form.note || null, warehouseId: form.warehouseId ? Number(form.warehouseId) : null })
      if (modal === 'recuento') {
        const lines = Object.entries(count).filter(([, v]) => v !== '').map(([id, v]) => ({ ingredientId: Number(id), qty: Number(v), unit: ings.find(i => i.id === Number(id))!.base_unit }))
        if (!lines.length) throw new Error('No has introducido ningún recuento')
        const r = await api.post('/api/stock/counts', { lines, warehouseId: form.warehouseId ? Number(form.warehouseId) : null })
        alert(`Recuento registrado: ${r.results.length} ingrediente(s). Desviación total ${eur(r.results.reduce((s: number, x: any) => s + x.deviationValue, 0))}.`)
      }
      setModal(null); setForm({}); setCount({}); await load()
    } catch (e) { setMsg(errorMessage(e)) }
    setSaving(false)
  }

  const byWarehouse = new Map<string, Ing[]>()
  for (const i of ings) { const k = i.warehouse_name || 'Sin asignar'; (byWarehouse.get(k) ?? byWarehouse.set(k, []).get(k)!).push(i) }
  const groups = Array.from(byWarehouse.entries()).sort((a, b) => a[0] === 'Sin asignar' ? 1 : b[0] === 'Sin asignar' ? -1 : a[0].localeCompare(b[0]))

  return (
    <Page eyebrow="Food cost · Almacén" title="Almacenes y stock" subtitle="El stock es la suma de movimientos: entra con los albaranes validados y sale con mermas, producción y recuentos."
      actions={<><Btn kind="ghost" onClick={() => { setForm({}); setMsg(''); setModal('almacen') }}>+ ALMACÉN</Btn><Btn kind="ghost" onClick={() => { setForm({ unit: 'kg' }); setMsg(''); setModal('ajuste') }}>AJUSTE</Btn><Btn onClick={() => { setForm({}); setCount({}); setMsg(''); setModal('recuento') }}>RECUENTO FÍSICO</Btn></>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Stat label="Valor del stock" value={eur(totalValue)} sub="existencias × coste actual" />
        <Stat label="Referencias con stock" value={levels.length} />
        <Stat label="Almacenes" value={warehouses.length} />
        <Stat label="Sin almacén asignado" value={ings.filter(i => !i.warehouse_id).length} tone={ings.some(i => !i.warehouse_id) ? 'warn' : 'ok'} />
      </div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 14, border: `1.5px solid ${tk.iron}`, width: 'fit-content' }}>
        {(['stock', 'ubicaciones'] as const).map(t => <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 16px', background: tab === t ? tk.iron : tk.paper, color: tab === t ? tk.cream : tk.iron, border: 'none', cursor: 'pointer', fontFamily: ff.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t === 'stock' ? 'Existencias' : 'Ubicaciones'}</button>)}
      </div>
      {msg && !modal && <Note tone="crit">{msg}</Note>}

      {loading ? <Loading /> : tab === 'stock' ? (
        <Panel title="Existencias teóricas">
          {levels.length === 0 ? <Empty>Sin movimientos de stock todavía. Valida un albarán para que entren las primeras existencias.</Empty> : (
            <Table head={['Ingrediente', 'Almacén', 'Existencias', 'Valor', 'Último movimiento']} right={[2, 3]}>
              {levels.map((l, i) => (
                <Tr key={i}>
                  <Td><Link href={`/dashboard/ingredientes/${l.ingredient_id}`} style={{ color: tk.iron, textDecoration: 'none', borderBottom: `1px solid ${tk.iron40}` }}>{l.name}</Link></Td>
                  <Td style={{ color: tk.iron60 }}>{l.warehouse_name || '—'}</Td>
                  <Td right style={{ fontWeight: 600, color: l.qty < 0 ? tk.terra : tk.iron }}>{num(l.qty)} {l.base_unit}</Td>
                  <Td right>{eur(l.value)}</Td>
                  <Td style={{ color: tk.iron60 }}>{fecha(l.last_movement)}</Td>
                </Tr>
              ))}
            </Table>
          )}
        </Panel>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groups.map(([name, items]) => (
            <Panel key={name} title={<span style={{ color: name === 'Sin asignar' ? tk.terra : tk.iron }}>{name} · {items.length} referencia{items.length !== 1 ? 's' : ''}</span>} right={warehouses.find(w => w.name === name) ? <span style={{ fontFamily: ff.mono, fontSize: 10, color: tk.iron40 }}>{KIND[warehouses.find(w => w.name === name)!.kind]}</span> : undefined}>
              <Table head={['Ingrediente', 'Categoría', 'Proveedor', 'Coste']} right={[3]}>
                {items.map(i => <Tr key={i.id}><Td style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 12.5 }}>{i.name}</Td><Td style={{ color: tk.iron60 }}>{i.category || '—'}</Td><Td style={{ color: tk.iron60 }}>{i.supplier_name || 'sin proveedor'}</Td><Td right>{i.cost != null ? `${eur(i.cost)}/${i.base_unit}` : '—'}</Td></Tr>)}
              </Table>
            </Panel>
          ))}
          {groups.length === 0 && <Empty>Sin ingredientes.</Empty>}
        </div>
      )}

      {modal === 'almacen' && (
        <Modal title="Nuevo almacén" onClose={() => setModal(null)} width={420}>
          <Field label="Nombre"><Input value={form.name ?? ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus /></Field>
          <div style={{ marginTop: 12 }}><Field label="Tipo"><Select value={form.kind ?? 'other'} onChange={e => setForm(p => ({ ...p, kind: e.target.value }))}>{Object.entries(KIND).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field></div>
          {msg && <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.terra, margin: '14px 0 0' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}><Btn kind="ghost" onClick={() => setModal(null)}>CANCELAR</Btn><Btn onClick={submit} disabled={saving || !form.name}>GUARDAR</Btn></div>
        </Modal>
      )}
      {modal === 'ajuste' && (
        <Modal title="Ajuste de stock" onClose={() => setModal(null)} width={460}>
          <Note>Un ajuste corrige las existencias sin tocar el pasado: positivo entra, negativo sale.</Note>
          <Field label="Ingrediente"><Select value={form.ingredientId ?? ''} onChange={e => { const ing = ings.find(i => String(i.id) === e.target.value); setForm(p => ({ ...p, ingredientId: e.target.value, unit: ing?.base_unit ?? p.unit, warehouseId: ing?.warehouse_id ? String(ing.warehouse_id) : '' })) }}><option value="">— elegir —</option>{ings.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Cantidad (±)"><Input type="number" step="any" value={form.qty ?? ''} onChange={e => setForm(p => ({ ...p, qty: e.target.value }))} /></Field>
            <Field label="Unidad"><Input value={form.unit ?? ''} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} /></Field>
          </div>
          <div style={{ marginTop: 12 }}><Field label="Motivo"><Input value={form.note ?? ''} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} /></Field></div>
          {msg && <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.terra, margin: '14px 0 0' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}><Btn kind="ghost" onClick={() => setModal(null)}>CANCELAR</Btn><Btn onClick={submit} disabled={saving || !form.ingredientId || !form.qty}>REGISTRAR</Btn></div>
        </Modal>
      )}
      {modal === 'recuento' && (
        <Modal title="Recuento físico" onClose={() => setModal(null)} width={620}>
          <Note>Escribe lo que hay de verdad. La diferencia con el teórico queda como movimiento de recuento; lo que dejes en blanco no se toca.</Note>
          <div style={{ maxHeight: '50vh', overflowY: 'auto', border: `1px solid ${tk.iron20}` }}>
            <Table head={['Ingrediente', 'Teórico', 'Contado']} right={[1]}>
              {ings.map(i => {
                const th = levels.filter(l => l.ingredient_id === i.id).reduce((s, l) => s + l.qty, 0)
                return <Tr key={i.id}><Td>{i.name}</Td><Td right style={{ color: tk.iron60 }}>{num(th)} {i.base_unit}</Td><Td><Input type="number" step="any" min={0} placeholder={i.base_unit} value={count[i.id] ?? ''} onChange={e => setCount(p => ({ ...p, [i.id]: e.target.value }))} style={{ width: 120, padding: '5px 8px' }} /></Td></Tr>
              })}
            </Table>
          </div>
          {msg && <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.terra, margin: '14px 0 0' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}><Btn kind="ghost" onClick={() => setModal(null)}>CANCELAR</Btn><Btn onClick={submit} disabled={saving}>REGISTRAR RECUENTO</Btn></div>
        </Modal>
      )}
    </Page>
  )
}
