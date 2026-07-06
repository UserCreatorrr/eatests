'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { CATEGORIAS_INGREDIENTE, ALMACENES, TIPOS_IVA, ivaPorCategoria, almacenPorCategoria } from '@/lib/catalog'

type Ingrediente = {
  id: number
  codi: string | null
  descr: string | null
  type: string | null
  unit: string | null
  cost: number | null
  iva: number | null
  proveedor_id: number | null
  proveedor_nombre: string | null
  almacen_principal: string | null
  almacen_secundario: string | null
}

type Proveedor = {
  id: number
  descr: string
  descr_type: string | null
}

function fmt(v: number | null) {
  if (v == null) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}

export default function IngredientesPage() {
  const [rows, setRows] = useState<Ingrediente[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Ingrediente>>({})
  const [assigningId, setAssigningId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [ingRes, provRes] = await Promise.all([
      fetch('/api/data/ingredientes?limit=5000'),
      fetch('/api/data/proveedores?limit=200'),
    ])
    const ingJson = await ingRes.json()
    const provJson = await provRes.json()
    setRows(ingJson.data || [])
    setProveedores(provJson.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r =>
    !search || [r.descr, r.codi, r.type, r.proveedor_nombre].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )

  async function assignProveedor(ing: Ingrediente, prov: Proveedor | null) {
    setSaving(true)
    await fetch(`/api/data/ingredientes/${ing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proveedor_id: prov?.id ?? null, proveedor_nombre: prov?.descr ?? null }),
    })
    setRows(prev => prev.map(r => r.id === ing.id
      ? { ...r, proveedor_id: prov?.id ?? null, proveedor_nombre: prov?.descr ?? null }
      : r
    ))
    setAssigningId(null)
    setSaving(false)
  }

  function openAdd() {
    setEditingId(null)
    setForm({})
    setMsg('')
    setModalOpen(true)
  }

  function openEdit(r: Ingrediente) {
    setEditingId(r.id)
    setForm({ codi: r.codi || '', descr: r.descr || '', type: r.type || '', unit: r.unit || '', cost: r.cost ?? undefined, iva: r.iva ?? undefined, almacen_principal: r.almacen_principal || '', almacen_secundario: r.almacen_secundario || '' })
    setMsg('')
    setModalOpen(true)
  }

  async function save() {
    setSaving(true)
    setMsg('')
    const body = {
      ...form,
      cost: form.cost !== undefined && form.cost !== null && (form.cost as any) !== '' ? Number(form.cost) : null,
      iva: form.iva !== undefined && form.iva !== null && (form.iva as any) !== '' ? Number(form.iva) : null,
    }
    const url = editingId ? `/api/data/ingredientes/${editingId}` : '/api/data/ingredientes'
    const method = editingId ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) { const j = await res.json(); setMsg(j.error || 'Error'); setSaving(false); return }
    setModalOpen(false)
    load()
    setSaving(false)
  }

  async function del(id: number) {
    if (!confirm('¿Eliminar este ingrediente?')) return
    await fetch(`/api/data/ingredientes/${id}`, { method: 'DELETE' })
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const sinProveedor = rows.filter(r => !r.proveedor_id).length
  const conProveedor = rows.filter(r => r.proveedor_id).length

  return (
    <div className="p-8">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ingredientes</h1>
          <p className="page-subtitle">
            {rows.length} ingredientes · <span style={{ color: '#0fa651' }}>{conProveedor} con proveedor</span> · <span style={{ opacity: 0.5 }}>{sinProveedor} sin asignar</span>
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary">+ Añadir</button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar ingrediente, tipo, proveedor..."
          style={{ width: '100%', maxWidth: 480, padding: '10px 14px', borderRadius: 0, border: '1.5px solid #e8e2db', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#3d3834', outline: 'none', backgroundColor: 'var(--paper)', boxSizing: 'border-box' }}
          onFocus={e => e.currentTarget.style.borderColor = '#19f973'}
          onBlur={e => e.currentTarget.style.borderColor = '#e8e2db'}
        />
      </div>

      {loading ? (
        <p className="page-subtitle">Cargando...</p>
      ) : (
        <div style={{ backgroundColor: 'var(--paper)', borderRadius: 0, border: '1px solid #e8e2db', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#ece4d8' }}>
                {['Código', 'Nombre', 'Categoría', 'Unidad', 'Coste', 'IVA', 'Almacén', 'Proveedor', ''].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.5, fontWeight: 600, borderBottom: '1px solid #e8e2db', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ing, idx) => (
                <tr key={ing.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #e8e2db' : 'none' }}>
                  <td style={{ padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.4 }}>{ing.codi || '-'}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 13 }}>
                    <Link href={`/dashboard/ingredientes/${ing.id}`} title="Ver ficha de trazabilidad" style={{ color: '#3d3834', textDecoration: 'none', borderBottom: '1.5px solid #19f973' }}>
                      {ing.descr || '-'}
                    </Link>
                  </td>
                  <td style={{ padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.45 }}>{ing.type || '-'}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834' }}>{ing.unit || '-'}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', whiteSpace: 'nowrap' }}>{fmt(ing.cost)}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6c635a', whiteSpace: 'nowrap' }}>{ing.iva != null ? `${ing.iva}%` : '-'}</td>
                  <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                    {ing.almacen_principal ? (
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10.5, padding: '2px 8px', backgroundColor: '#ece4d8', color: '#6c635a', border: '1px solid #c4b8a8' }}>{ing.almacen_principal}</span>
                    ) : (
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10.5, color: '#a83e1e', opacity: 0.7 }}>sin asignar</span>
                    )}
                  </td>

                  {/* Proveedor selector */}
                  <td style={{ padding: '6px 14px', minWidth: 200 }}>
                    {assigningId === ing.id ? (
                      <select
                        autoFocus
                        defaultValue={ing.proveedor_id ?? ''}
                        onChange={e => {
                          const pid = e.target.value ? Number(e.target.value) : null
                          const prov = pid ? proveedores.find(p => p.id === pid) || null : null
                          assignProveedor(ing, prov)
                        }}
                        onBlur={() => setAssigningId(null)}
                        style={{ width: '100%', padding: '5px 8px', borderRadius: 0, border: '1.5px solid #19f973', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', backgroundColor: 'var(--paper)', outline: 'none', cursor: 'pointer' }}
                      >
                        <option value="">Sin proveedor</option>
                        {proveedores.map(p => (
                          <option key={p.id} value={p.id}>{p.descr}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setAssigningId(ing.id)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '5px 10px',
                          backgroundColor: ing.proveedor_id ? '#d6f9e0' : '#ece4d8',
                          border: `1px solid ${ing.proveedor_id ? '#0fa651' : '#e8e2db'}`,
                          borderRadius: 7, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12,
                          color: ing.proveedor_id ? '#0fa651' : '#3d3834',
                          opacity: ing.proveedor_id ? 1 : 0.45,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                        title="Clic para asignar proveedor"
                      >
                        {ing.proveedor_nombre || '+ Asignar proveedor'}
                      </button>
                    )}
                  </td>

                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEdit(ing)} style={{ padding: '4px 8px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#3d3834', opacity: 0.4, fontSize: 13 }}>✏️</button>
                    <button onClick={() => del(ing.id)} style={{ padding: '4px 8px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#a83e1e', opacity: 0.5, fontSize: 13 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#3d3834', opacity: 0.4, padding: '20px 16px', textAlign: 'center' }}>Sin resultados</p>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) setModalOpen(false) }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(61,56,52,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#faf6ec', border: '1.5px solid #3d3834', padding: '28px 32px', width: 480, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 24px' }}>
              <h2 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 16, color: '#3d3834', margin: 0 }}>
                {editingId ? 'Editar ingrediente' : 'Nuevo ingrediente'}
              </h2>
              <button onClick={() => setModalOpen(false)} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3d3834', opacity: 0.5, display: 'flex' }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Texto: código, nombre */}
              {[
                { key: 'codi', label: 'Código' },
                { key: 'descr', label: 'Nombre' },
              ].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <input
                    type="text"
                    value={(form as any)[f.key] ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={fieldStyle}
                    onFocus={e => e.currentTarget.style.borderColor = '#3d3834'}
                    onBlur={e => e.currentTarget.style.borderColor = '#c4b8a8'}
                  />
                </div>
              ))}

              {/* Categoría: desplegable estándar. Al elegir, autocompleta IVA y almacén si están vacíos. */}
              <div>
                <label style={labelStyle}>Categoría</label>
                <select
                  value={(form as any).type ?? ''}
                  onChange={e => {
                    const cat = e.target.value
                    setForm(prev => ({
                      ...prev,
                      type: cat,
                      iva: (prev as any).iva ?? (cat ? ivaPorCategoria(cat) : undefined),
                      almacen_principal: (prev as any).almacen_principal || (cat ? almacenPorCategoria(cat) : ''),
                    }))
                  }}
                  style={{ ...fieldStyle, cursor: 'pointer' }}
                >
                  <option value="">— seleccionar categoría —</option>
                  {CATEGORIAS_INGREDIENTE.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Unidad + Coste + IVA en una fila */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Unidad base</label>
                  <input type="text" value={(form as any).unit ?? ''} onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="kg, l, ud" style={fieldStyle} onFocus={e => e.currentTarget.style.borderColor = '#3d3834'} onBlur={e => e.currentTarget.style.borderColor = '#c4b8a8'} />
                </div>
                <div>
                  <label style={labelStyle}>Coste (€)</label>
                  <input type="number" step="0.0001" value={(form as any).cost ?? ''} onChange={e => setForm(prev => ({ ...prev, cost: e.target.value as any }))}
                    style={fieldStyle} onFocus={e => e.currentTarget.style.borderColor = '#3d3834'} onBlur={e => e.currentTarget.style.borderColor = '#c4b8a8'} />
                </div>
                <div>
                  <label style={labelStyle}>IVA</label>
                  <select value={(form as any).iva ?? ''} onChange={e => setForm(prev => ({ ...prev, iva: e.target.value === '' ? undefined : Number(e.target.value) as any }))}
                    style={{ ...fieldStyle, cursor: 'pointer' }}>
                    <option value="">—</option>
                    {TIPOS_IVA.map(v => <option key={v} value={v}>{v}%</option>)}
                  </select>
                </div>
              </div>

              {/* Almacenes (ubicaciones reales) */}
              {([['almacen_principal', 'Almacén principal'], ['almacen_secundario', 'Almacén secundario (opcional)']] as const).map(([key, label]) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <select
                    value={(form as any)[key] ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ ...fieldStyle, cursor: 'pointer' }}
                  >
                    <option value="">— sin asignar —</option>
                    {ALMACENES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {msg && <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#a83e1e', marginTop: 10 }}>{msg}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: '11px', backgroundColor: '#19f973', border: 'none', borderRadius: 0, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 14, color: '#2a2522', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setModalOpen(false)} style={{ padding: '11px 20px', backgroundColor: '#f5f2ee', border: '1px solid #e8e2db', borderRadius: 0, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#3d3834' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontFamily: 'DM Mono, monospace', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a8f82', display: 'block', marginBottom: 5 }
const fieldStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 0, border: '1.5px solid #c4b8a8', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#3d3834', outline: 'none', backgroundColor: '#dfd5c9' }
