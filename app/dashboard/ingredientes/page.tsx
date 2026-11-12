'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api, errorMessage } from '@/lib/api'
import { CATEGORIAS_INGREDIENTE, ivaPorCategoria } from '@/lib/catalog'
import { tk, ff } from '@/lib/design'
import { eur } from '@/lib/format'
import { BASE_UNIT_OPTIONS, IVA_OPTIONS, dimOf } from '@/lib/units-ui'
import { Badge, Btn, Chip, Empty, Field, Input, Loading, Modal, Page, Panel, SearchBox, Select, Table, Td, Tr } from '@/components/ui'

type Ingredient = { id: number; code: string | null; name: string; category: string | null; base_unit: string; cost: number | null; vat_rate: number | null; supplier_id: number | null; supplier_name: string | null; warehouse_id: number | null; warehouse_name: string | null; avg_unit_weight_g: number | null; notes: string | null }
type Supplier = { id: number; name: string }
type Warehouse = { id: number; name: string }
type Filtro = 'todos' | 'sin_proveedor' | 'con_proveedor' | 'sin_coste' | 'sin_almacen'

const EMPTY = { code: '', name: '', category: '', baseUnit: 'kg', cost: '', vatRate: '', supplierId: '', warehouseId: '', avgUnitWeightG: '', notes: '' }

export default function IngredientesPage() {
  const [rows, setRows] = useState<Ingredient[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Ingredient | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [assigning, setAssigning] = useState<number | null>(null)

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('filtro')
    if (f && ['sin_proveedor', 'con_proveedor', 'sin_coste', 'sin_almacen'].includes(f)) setFiltro(f as Filtro)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [i, s, w] = await Promise.all([api.get('/api/ingredients'), api.get('/api/suppliers'), api.get('/api/warehouses')])
      setRows(i.data); setSuppliers(s.data); setWarehouses(w.data)
    } catch (e) { setMsg(errorMessage(e)) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const match = (r: Ingredient) => filtro === 'todos' ? true : filtro === 'sin_proveedor' ? !r.supplier_id : filtro === 'con_proveedor' ? !!r.supplier_id : filtro === 'sin_coste' ? !r.cost : !r.warehouse_id
  const q = search.toLowerCase()
  const visible = rows.filter(r => match(r) && (!q || [r.name, r.code, r.category, r.supplier_name].some(v => v?.toLowerCase().includes(q))))

  function openNew() { setEditing(null); setForm({ ...EMPTY }); setMsg(''); setModal(true) }
  function openEdit(r: Ingredient) {
    setEditing(r); setMsg('')
    setForm({ code: r.code ?? '', name: r.name, category: r.category ?? '', baseUnit: r.base_unit, cost: r.cost != null ? String(r.cost) : '', vatRate: r.vat_rate != null ? String(r.vat_rate) : '',
      supplierId: r.supplier_id ? String(r.supplier_id) : '', warehouseId: r.warehouse_id ? String(r.warehouse_id) : '', avgUnitWeightG: r.avg_unit_weight_g != null ? String(r.avg_unit_weight_g) : '', notes: r.notes ?? '' })
    setModal(true)
  }

  async function save() {
    // Cambiar la magnitud (kg → ud) recalcula las recetas que lo usan: se confirma con el número afectado.
    if (editing && form.baseUnit !== editing.base_unit && dimOf(form.baseUnit) !== dimOf(editing.base_unit)) {
      let n = 0
      try { n = (await api.get(`/api/ingredients/${editing.id}`)).usage.length } catch { /* sin dato */ }
      if (!confirm(`Vas a cambiar la unidad de ${editing.base_unit} a ${form.baseUnit}, que son magnitudes distintas.${n ? `\n\n${n} receta(s) usan este ingrediente y su coste se recalculará.` : ''}\n\n¿Continuar?`)) return
    }
    setSaving(true); setMsg('')
    const body = {
      code: form.code.trim() || null, name: form.name.trim(), category: form.category || null, baseUnit: form.baseUnit, cost: form.cost === '' ? null : Number(form.cost),
      vatRate: form.vatRate === '' ? null : Number(form.vatRate), supplierId: form.supplierId ? Number(form.supplierId) : null, warehouseId: form.warehouseId ? Number(form.warehouseId) : null,
      avgUnitWeightG: form.avgUnitWeightG === '' ? null : Number(form.avgUnitWeightG), notes: form.notes.trim() || null,
    }
    try {
      if (editing) await api.patch(`/api/ingredients/${editing.id}`, body)
      else await api.post('/api/ingredients', body)
      setModal(false); await load()
    } catch (e) { setMsg(errorMessage(e)) }
    setSaving(false)
  }

  async function assignSupplier(r: Ingredient, supplierId: number | null) {
    try {
      await api.patch(`/api/ingredients/${r.id}`, { supplierId })
      await load()
    } catch (e) { alert(errorMessage(e)) }
    setAssigning(null)
  }

  async function remove(r: Ingredient) {
    if (!confirm(`¿Eliminar "${r.name}"? Si está en recetas o documentos se desactiva en vez de borrarse.`)) return
    try { await api.del(`/api/ingredients/${r.id}`); await load() } catch (e) { alert(errorMessage(e)) }
  }

  const counts = { sinProv: rows.filter(r => !r.supplier_id).length, conProv: rows.filter(r => r.supplier_id).length, sinCoste: rows.filter(r => !r.cost).length, sinAlm: rows.filter(r => !r.warehouse_id).length }

  return (
    <Page eyebrow="Food cost · Catálogo" title="Ingredientes" subtitle={`${rows.length} ingredientes en el catálogo`} actions={<><SearchBox value={search} onChange={setSearch} placeholder="Buscar ingrediente, categoría, proveedor…" /><Btn onClick={openNew}>+ AÑADIR</Btn></>}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Chip active={filtro === 'todos'} color={tk.iron} onClick={() => setFiltro('todos')}>Todos · {rows.length}</Chip>
        <Chip active={filtro === 'con_proveedor'} color={tk.appleDeep} onClick={() => setFiltro('con_proveedor')}>Con proveedor · {counts.conProv}</Chip>
        <Chip active={filtro === 'sin_proveedor'} color={tk.clay} onClick={() => setFiltro('sin_proveedor')}>Sin proveedor · {counts.sinProv}</Chip>
        <Chip active={filtro === 'sin_coste'} color={tk.terra} onClick={() => setFiltro('sin_coste')}>Sin coste · {counts.sinCoste}</Chip>
        <Chip active={filtro === 'sin_almacen'} color={tk.clay} onClick={() => setFiltro('sin_almacen')}>Sin almacén · {counts.sinAlm}</Chip>
      </div>

      <Panel>
        {loading ? <Loading /> : visible.length === 0 ? <Empty>{rows.length ? 'Sin resultados.' : 'Sin ingredientes. Añade el primero o escanea un albarán.'}</Empty> : (
          <Table head={['Código', 'Nombre', 'Categoría', 'Unidad', 'Coste', 'IVA', 'Almacén', 'Proveedor', '']} right={[4]}>
            {visible.map(r => (
              <Tr key={r.id}>
                <Td style={{ color: tk.iron40 }}>{r.code || '—'}</Td>
                <Td><Link href={`/dashboard/ingredientes/${r.id}`} style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 13, color: tk.iron, textDecoration: 'none', borderBottom: `1.5px solid ${tk.apple}` }}>{r.name}</Link></Td>
                <Td style={{ color: tk.iron60 }}>{r.category || '—'}</Td>
                <Td>{r.base_unit}</Td>
                <Td right>{r.cost ? <>{eur(r.cost)}<span style={{ color: tk.iron40 }}>/{r.base_unit}</span></> : <span style={{ color: tk.terra }}>sin coste</span>}</Td>
                <Td style={{ color: tk.iron60 }}>{r.vat_rate != null ? `${r.vat_rate}%` : '—'}</Td>
                <Td>{r.warehouse_name ? <Badge>{r.warehouse_name}</Badge> : <span style={{ color: tk.terra, opacity: 0.7, fontSize: 10.5 }}>sin asignar</span>}</Td>
                <Td style={{ minWidth: 190 }}>
                  {assigning === r.id ? (
                    <Select autoFocus defaultValue={r.supplier_id ?? ''} onBlur={() => setAssigning(null)} onChange={e => assignSupplier(r, e.target.value ? Number(e.target.value) : null)} style={{ padding: '5px 8px', fontSize: 11.5, borderColor: tk.apple }}>
                      <option value="">Sin proveedor</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                  ) : (
                    <button onClick={() => setAssigning(r.id)} title="Clic para asignar proveedor" style={{ width: '100%', textAlign: 'left', padding: '5px 10px', background: r.supplier_id ? tk.appleSoft : tk.creamSoft, border: `1px solid ${r.supplier_id ? tk.appleDeep : tk.iron20}`, cursor: 'pointer', fontFamily: ff.mono, fontSize: 11.5, color: r.supplier_id ? tk.appleDeep : tk.iron60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.supplier_name || '+ Asignar proveedor'}
                    </button>
                  )}
                </Td>
                <Td right><div style={{ display: 'inline-flex', gap: 6 }}><Btn small kind="ghost" onClick={() => openEdit(r)}>EDITAR</Btn><Btn small kind="danger" onClick={() => remove(r)}>×</Btn></div></Td>
              </Tr>
            ))}
          </Table>
        )}
      </Panel>

      {modal && (
        <Modal title={editing ? 'Editar ingrediente' : 'Nuevo ingrediente'} onClose={() => setModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <Field label="Código"><Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} /></Field>
            <Field label="Nombre *"><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Categoría" hint="Al elegirla se propone el IVA habitual.">
              <Select value={form.category} onChange={e => { const cat = e.target.value; setForm(p => ({ ...p, category: cat, vatRate: p.vatRate || (cat ? String(ivaPorCategoria(cat)) : '') })) }}>
                <option value="">— seleccionar —</option>
                {CATEGORIAS_INGREDIENTE.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Unidad base *" hint="En la que se compra y se controla.">
              <Select value={form.baseUnit} onChange={e => setForm(p => ({ ...p, baseUnit: e.target.value }))}>{BASE_UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</Select>
            </Field>
            <Field label={`Coste (€/${form.baseUnit})`}><Input type="number" step="0.0001" min={0} value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} /></Field>
            <Field label="IVA"><Select value={form.vatRate} onChange={e => setForm(p => ({ ...p, vatRate: e.target.value }))}><option value="">—</option>{IVA_OPTIONS.map(v => <option key={v} value={v}>{v}%</option>)}</Select></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Proveedor" hint="Con proveedor hace falta precio.">
              <Select value={form.supplierId} onChange={e => setForm(p => ({ ...p, supplierId: e.target.value }))}><option value="">— sin asignar —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            </Field>
            <Field label="Almacén"><Select value={form.warehouseId} onChange={e => setForm(p => ({ ...p, warehouseId: e.target.value }))}><option value="">— sin asignar —</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
          </div>
          {form.baseUnit === 'kg' && (
            <div style={{ marginTop: 12 }}>
              <Field label="Peso medio por unidad (g)" hint="Opcional: permite usar “ud” en recetas de un ingrediente que se compra por kg (p. ej. huevo 60 g)."><Input type="number" step="1" min={0} value={form.avgUnitWeightG} onChange={e => setForm(p => ({ ...p, avgUnitWeightG: e.target.value }))} /></Field>
            </div>
          )}
          <div style={{ marginTop: 12 }}><Field label="Notas"><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></Field></div>
          {msg && <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.terra, margin: '14px 0 0' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
            <Btn kind="ghost" onClick={() => setModal(false)}>CANCELAR</Btn>
            <Btn onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'GUARDANDO…' : 'GUARDAR'}</Btn>
          </div>
        </Modal>
      )}
    </Page>
  )
}
