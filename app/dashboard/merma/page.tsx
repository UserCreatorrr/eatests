'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { eur, fecha, hoyIso, num } from '@/lib/format'
import { unitsCompatibleWith } from '@/lib/units-ui'
import { Btn, Empty, Field, Input, Loading, Note, Page, Panel, Select, Stat, Table, Td, Tr } from '@/components/ui'

const MOTIVOS = ['caducidad', 'sobreproducción', 'error cocina', 'devolución', 'mala recepción', 'rotura', 'staff meal', 'otro']
const SERVICIOS = ['Desayuno', 'Comida', 'Cena', 'Entre servicios', 'Prep']
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function MermaPage() {
  const [ings, setIngs] = useState<any[]>([])
  const [recipes, setRecipes] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ kind: 'ingredient' as 'ingredient' | 'dish', ingredientId: '', recipeId: '', description: '', qty: '', unit: '', reason: 'caducidad', service: 'Comida', occurredOn: hoyIso(), notes: '', consumeStock: false })

  const load = useCallback(async () => {
    try {
      const [w, i, r] = await Promise.all([api.get('/api/waste'), api.get('/api/ingredients'), api.get('/api/recipes')])
      setRows(w.data); setStats(w.stats); setIngs(i.data); setRecipes(r.data.filter((x: any) => x.kind === 'dish'))
    } catch (e) { setMsg(errorMessage(e)) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const ing = ings.find(i => String(i.id) === form.ingredientId)
  const rec = recipes.find(r => String(r.id) === form.recipeId)
  const preview = (() => {
    const q = Number(form.qty); if (!q) return null
    if (form.kind === 'ingredient' && ing?.cost) { const u = unitsCompatibleWith(ing.base_unit).find(x => x.value === form.unit); const base = unitsCompatibleWith(ing.base_unit).find(x => x.value === ing.base_unit); if (!u || !base) return null; const f: Record<string, number> = { kg: 1, g: 0.001, mg: 0.000001, l: 1, cl: 0.01, ml: 0.001, ud: 1, docena: 12 }; return Math.round(q * (f[form.unit] / f[ing.base_unit]) * ing.cost * 100) / 100 }
    if (form.kind === 'dish' && rec) return Math.round(rec.per_portion * q * 100) / 100
    return null
  })()

  async function save() {
    setSaving(true); setMsg('')
    try {
      await api.post('/api/waste', { kind: form.kind, ingredientId: form.kind === 'ingredient' && form.ingredientId ? Number(form.ingredientId) : null, recipeId: form.kind === 'dish' && form.recipeId ? Number(form.recipeId) : null,
        description: form.description || null, qty: Number(form.qty), unit: form.kind === 'dish' ? 'ud' : form.unit, reason: form.reason, service: form.service, occurredOn: form.occurredOn, notes: form.notes || null, consumeStock: form.kind === 'ingredient' && form.consumeStock })
      setForm(f => ({ ...f, ingredientId: '', recipeId: '', description: '', qty: '', notes: '' })); await load()
    } catch (e) { setMsg(errorMessage(e)) }
    setSaving(false)
  }
  async function remove(id: number) { if (!confirm('¿Eliminar este registro de merma?')) return; try { await api.del(`/api/waste/${id}`); await load() } catch (e) { alert(errorMessage(e)) } }

  const monthCost = stats?.month_total?.cost ?? 0

  return (
    <Page eyebrow="Food cost · Merma / desperdicio" title="¿Qué pérdida tienes que controlar?" subtitle="Registra pérdidas de ingredientes o platos. El coste sale del catálogo (en su unidad base) o del escandallo, y alimenta el food cost real.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Stat label="Merma este mes" value={eur(monthCost)} sub={`${stats?.month_total?.n ?? 0} eventos`} tone={monthCost > 300 ? 'crit' : monthCost > 100 ? 'warn' : undefined} />
        <Stat label="Top motivo" value={stats?.byReason?.[0] ? cap(stats.byReason[0].reason) : '—'} sub={stats?.byReason?.[0] ? eur(stats.byReason[0].cost) : 'sin datos'} />
        <Stat label="Acumulado año" value={eur(stats?.year_total?.cost ?? 0)} />
      </div>
      {msg && <Note tone="crit">{msg}</Note>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <Panel title="Registrar merma">
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', border: `1.5px solid ${tk.iron}`, width: 'fit-content' }}>
              {(['ingredient', 'dish'] as const).map(t => <button key={t} onClick={() => setForm(f => ({ ...f, kind: t, unit: '' }))} style={{ padding: '6px 14px', background: form.kind === t ? tk.iron : tk.paper, color: form.kind === t ? tk.cream : tk.iron, border: 'none', cursor: 'pointer', fontFamily: ff.mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t === 'ingredient' ? 'Ingrediente' : 'Plato / receta'}</button>)}
            </div>
            {form.kind === 'ingredient' ? (
              <Field label="Ingrediente"><Select value={form.ingredientId} onChange={e => { const i = ings.find(x => String(x.id) === e.target.value); setForm(f => ({ ...f, ingredientId: e.target.value, unit: i?.base_unit ?? '' })) }}><option value="">— buscar en catálogo —</option>{ings.map(i => <option key={i.id} value={i.id}>{i.name}{i.cost ? ` · ${eur(i.cost)}/${i.base_unit}` : ''}</option>)}</Select></Field>
            ) : (
              <Field label="Plato"><Select value={form.recipeId} onChange={e => setForm(f => ({ ...f, recipeId: e.target.value }))}><option value="">— elegir receta —</option>{recipes.map(r => <option key={r.id} value={r.id}>{r.name} · {eur(r.per_portion)}/ración</option>)}</Select></Field>
            )}
            {!form.ingredientId && !form.recipeId && <Field label="O descripción libre"><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ej: pan del día" /></Field>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label={form.kind === 'dish' ? 'Raciones' : 'Cantidad'}><Input type="number" step="any" min={0} value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} /></Field>
              {form.kind === 'ingredient' && <Field label="Unidad"><Select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}><option value="">—</option>{(ing ? unitsCompatibleWith(ing.base_unit) : unitsCompatibleWith(null)).map(u => <option key={u.value} value={u.value}>{u.value}</option>)}</Select></Field>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Motivo"><Select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>{MOTIVOS.map(m => <option key={m} value={m}>{cap(m)}</option>)}</Select></Field>
              <Field label="Servicio"><Select value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))}>{SERVICIOS.map(s => <option key={s} value={s}>{s}</option>)}</Select></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Fecha"><Input type="date" value={form.occurredOn} onChange={e => setForm(f => ({ ...f, occurredOn: e.target.value }))} /></Field>
              <Field label="Comentario"><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Field>
            </div>
            {form.kind === 'ingredient' && form.ingredientId && <label style={{ fontFamily: ff.mono, fontSize: 11, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={form.consumeStock} onChange={e => setForm(f => ({ ...f, consumeStock: e.target.checked }))} /> descontar del stock</label>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: ff.mono, fontSize: 11.5, color: tk.iron60 }}>Coste estimado: <strong style={{ color: preview != null ? tk.iron : tk.iron40, fontFamily: ff.display, fontSize: 15 }}>{preview != null ? eur(preview) : '—'}</strong></span>
              <Btn onClick={save} disabled={saving || !form.qty || (form.kind === 'ingredient' ? (!form.ingredientId && !form.description) || !form.unit : !form.recipeId && !form.description)}>{saving ? 'GUARDANDO…' : 'REGISTRAR MERMA →'}</Btn>
            </div>
          </div>
        </Panel>
        <Panel title={`Top productos con merma · ${stats?.month ?? ''}`}>
          {!stats?.top?.length ? <Empty>Sin merma registrada este mes.</Empty> : (
            <Table head={['Producto', 'Eventos', 'Coste']} right={[1, 2]}>{stats.top.map((p: any, i: number) => <Tr key={i}><Td>{p.description}</Td><Td right>{p.n}</Td><Td right>{eur(p.cost)}</Td></Tr>)}</Table>
          )}
          {stats?.byReason?.length > 0 && <div style={{ padding: '10px 16px', borderTop: `1px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 11, color: tk.iron60 }}>{stats.byReason.map((r: any) => `${cap(r.reason)} ${eur(r.cost)}`).join(' · ')}</div>}
        </Panel>
      </div>
      <Panel title="Histórico de merma">
        {loading ? <Loading /> : rows.length === 0 ? <Empty>Sin registros. Añade el primero arriba.</Empty> : (
          <Table head={['Fecha', 'Producto', 'Cantidad', 'Motivo', 'Servicio', 'Coste', '']} right={[2, 5]}>
            {rows.map(r => <Tr key={r.id}><Td>{fecha(r.occurred_on)}</Td><Td>{r.description}{r.kind === 'dish' && <span style={{ color: tk.iron40, marginLeft: 6, fontSize: 10 }}>plato</span>}</Td><Td right>{num(r.qty)} {r.unit}</Td><Td>{r.reason ? cap(r.reason) : '—'}</Td><Td>{r.service || '—'}</Td><Td right style={{ color: tk.terra, fontWeight: 600 }}>{eur(r.estimated_cost)}</Td><Td right><Btn small kind="danger" onClick={() => remove(r.id)}>×</Btn></Td></Tr>)}
          </Table>
        )}
      </Panel>
    </Page>
  )
}
