'use client'
import { useCallback, useEffect, useState } from 'react'
import FoodCostCalculator from '@/components/FoodCostCalculator'
import { Badge, Btn, Chip, Empty, Field, Input, Loading, Modal, Page, Panel, SearchBox, Select, Table, Td, Tr } from '@/components/ui'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { eur, pct } from '@/lib/format'
import { UNIT_OPTIONS } from '@/lib/units-ui'

type Row = { id: number; name: string; category: string | null; kind: 'dish' | 'preparation'; portions: number; yield_qty: number | null; yield_unit: string | null; sale_price: number | null; active: number; total: number; per_portion: number; per_yield_unit: number | null; food_cost_pct: number | null; incomplete: number; cycle: boolean }

function fcTone(p: number | null): 'ok' | 'warn' | 'crit' | 'neutral' { return p == null ? 'neutral' : p < 33 ? 'ok' : p < 40 ? 'warn' : 'crit' }

export default function SangradoPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'' | 'dish' | 'preparation' | 'critical' | 'incomplete'>('')
  const [selected, setSelected] = useState<Row | null>(null)
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', category: '', kind: 'dish', portions: '1', salePrice: '', yieldQty: '', yieldUnit: 'g' })
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try { const r = await api.get('/api/recipes?all=1'); setRows(r.data) } catch (e) { setMsg(errorMessage(e)) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('receta')
    if (id && rows.length) { const r = rows.find(x => String(x.id) === id); if (r) openCalc(r) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length])

  function openCalc(r: Row) { setSelected(r); setOpen(true) }
  function closeCalc() { setOpen(false); setTimeout(() => setSelected(null), 300); load() }
  function openPreparation(id: number) { const r = rows.find(x => x.id === id); if (r) setSelected(r) }

  async function create() {
    setSaving(true); setMsg('')
    try {
      const r = await api.post('/api/recipes', { name: form.name, category: form.category || null, kind: form.kind, portions: Math.max(1, Math.round(Number(form.portions) || 1)), salePrice: form.salePrice === '' ? null : Number(form.salePrice),
        yieldQty: form.kind === 'preparation' && form.yieldQty !== '' ? Number(form.yieldQty) : null, yieldUnit: form.kind === 'preparation' && form.yieldQty !== '' ? form.yieldUnit : null })
      setModal(false); setForm({ name: '', category: '', kind: 'dish', portions: '1', salePrice: '', yieldQty: '', yieldUnit: 'g' }); await load(); openCalc({ ...r, total: 0, per_portion: 0, per_yield_unit: null, food_cost_pct: null, incomplete: 0, cycle: false })
    } catch (e) { setMsg(errorMessage(e)) }
    setSaving(false)
  }
  async function remove(r: Row) {
    if (!confirm(`¿Eliminar "${r.name}"? Si otra receta la usa, se desactiva en vez de borrarse.`)) return
    try { await api.del(`/api/recipes/${r.id}`); await load() } catch (e) { alert(errorMessage(e)) }
  }

  const q = search.toLowerCase()
  const visible = rows.filter(r => (filter === '' ? true : filter === 'critical' ? r.kind === 'dish' && (r.food_cost_pct ?? 0) >= 35 : filter === 'incomplete' ? r.incomplete > 0 || r.cycle : r.kind === filter) && (!q || r.name.toLowerCase().includes(q) || (r.category ?? '').toLowerCase().includes(q)))
  const critical = rows.filter(r => r.kind === 'dish' && (r.food_cost_pct ?? 0) >= 35).length, incomplete = rows.filter(r => r.incomplete > 0 || r.cycle).length

  return (
    <Page eyebrow="Food cost · Escandallo" title="Recetas y elaboraciones" subtitle="El coste sale de los precios vivos del catálogo, con merma por línea y elaboraciones anidadas."
      actions={<><SearchBox value={search} onChange={setSearch} placeholder="Buscar receta…" /><Btn kind="ghost" href="/dashboard/sangrado/importar">IMPORTAR EXCEL</Btn><Btn onClick={() => { setMsg(''); setModal(true) }}>+ NUEVA RECETA</Btn></>}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Chip active={filter === ''} color={tk.iron} onClick={() => setFilter('')}>Todas · {rows.length}</Chip>
        <Chip active={filter === 'dish'} color={tk.iron60} onClick={() => setFilter('dish')}>Platos · {rows.filter(r => r.kind === 'dish').length}</Chip>
        <Chip active={filter === 'preparation'} color="#5b44b8" onClick={() => setFilter('preparation')}>Elaboraciones · {rows.filter(r => r.kind === 'preparation').length}</Chip>
        <Chip active={filter === 'critical'} color={tk.terra} onClick={() => setFilter('critical')}>Food cost ≥ 35% · {critical}</Chip>
        <Chip active={filter === 'incomplete'} color={tk.clay} onClick={() => setFilter('incomplete')}>Coste incompleto · {incomplete}</Chip>
      </div>
      <Panel>
        {loading ? <Loading /> : visible.length === 0 ? <Empty>{rows.length ? 'Sin resultados.' : 'Sin recetas. Crea la primera o importa tu recetario en Excel.'}</Empty> : (
          <Table head={['Receta', 'Categoría', 'Tipo', 'Raciones / producción', 'Coste', 'Coste / ración', 'PVP', 'Food cost', '']} right={[4, 5, 6, 7]}>
            {visible.map(r => (
              <Tr key={r.id}>
                <Td><button onClick={() => openCalc(r)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: ff.display, fontWeight: 600, fontSize: 13, color: r.active ? tk.iron : tk.iron40, textAlign: 'left', borderBottom: `1.5px solid ${tk.apple}` }}>{r.name}</button>{!r.active && <Badge> inactiva</Badge>}</Td>
                <Td style={{ color: tk.iron60 }}>{r.category || '—'}</Td>
                <Td>{r.kind === 'preparation' ? <Badge tone="info">Elaboración</Badge> : <Badge>Plato</Badge>}</Td>
                <Td right>{r.kind === 'preparation' ? (r.yield_qty ? `${r.yield_qty} ${r.yield_unit}` : <span style={{ color: tk.clay }}>sin definir</span>) : r.portions}</Td>
                <Td right>{eur(r.total)}{r.incomplete > 0 && <span title={`${r.incomplete} línea(s) sin coste`} style={{ color: tk.clay, marginLeft: 4 }}>⚠</span>}{r.cycle && <span title="Referencia circular" style={{ color: tk.terra, marginLeft: 4 }}>↻</span>}</Td>
                <Td right>{r.kind === 'preparation' ? (r.per_yield_unit != null ? `${eur(r.per_yield_unit)}/${r.yield_unit}` : '—') : eur(r.per_portion)}</Td>
                <Td right>{r.kind === 'dish' ? eur(r.sale_price) : '—'}</Td>
                <Td right>{r.kind === 'dish' && r.food_cost_pct != null ? <Badge tone={fcTone(r.food_cost_pct)}>{pct(r.food_cost_pct)}</Badge> : <span style={{ color: tk.iron40 }}>—</span>}</Td>
                <Td right><div style={{ display: 'inline-flex', gap: 6 }}><Btn small onClick={() => openCalc(r)}>ESCANDALLO</Btn><Btn small kind="danger" onClick={() => remove(r)}>×</Btn></div></Td>
              </Tr>
            ))}
          </Table>
        )}
      </Panel>

      <div onClick={closeCalc} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .25s' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(720px, 92vw)', background: tk.paper, borderLeft: `1px solid ${tk.iron20}`, zIndex: 201, overflowY: 'auto', transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .3s cubic-bezier(.4,0,.2,1)', boxShadow: open ? '-8px 0 40px rgba(0,0,0,0.12)' : 'none' }}>
        <div style={{ position: 'sticky', top: 0, background: tk.paper, borderBottom: `1px solid ${tk.iron20}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
          <div><p style={{ fontFamily: ff.mono, fontSize: 10, textTransform: 'uppercase', color: tk.iron40, margin: '0 0 2px', letterSpacing: 1 }}>{selected?.kind === 'preparation' ? 'Elaboración' : 'Food cost'}</p><h2 style={{ fontFamily: ff.display, fontWeight: 700, fontSize: 17, color: tk.iron, margin: 0 }}>{selected?.name ?? ''}</h2></div>
          <button onClick={closeCalc} style={{ background: tk.creamSoft, border: 'none', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tk.iron }}><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div style={{ padding: '0 24px 32px' }}>{selected && <FoodCostCalculator key={selected.id} recipeId={selected.id} onOpenPreparation={openPreparation} onSaved={load} />}</div>
      </div>

      {modal && (
        <Modal title="Nueva receta" onClose={() => setModal(false)} width={480}>
          <Field label="Nombre *"><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Categoría"><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></Field>
            <Field label="Tipo"><Select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}><option value="dish">Plato (se vende)</option><option value="preparation">Elaboración (se usa en otras)</option></Select></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Raciones"><Input type="number" min={1} step="1" value={form.portions} onChange={e => setForm(f => ({ ...f, portions: e.target.value }))} /></Field>
            {form.kind === 'dish' ? <Field label="PVP / ración (€)"><Input type="number" min={0} step="0.01" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))} /></Field>
              : <Field label="Produce"><div style={{ display: 'flex', gap: 6 }}><Input type="number" min={0} step="0.001" value={form.yieldQty} onChange={e => setForm(f => ({ ...f, yieldQty: e.target.value }))} /><Select value={form.yieldUnit} onChange={e => setForm(f => ({ ...f, yieldUnit: e.target.value }))} style={{ width: 90 }}>{UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}</Select></div></Field>}
          </div>
          {msg && <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.terra, margin: '14px 0 0' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}><Btn kind="ghost" onClick={() => setModal(false)}>CANCELAR</Btn><Btn onClick={create} disabled={saving || !form.name.trim()}>CREAR Y ESCANDALLAR</Btn></div>
        </Modal>
      )}
    </Page>
  )
}
