'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export type FieldDef = {
  key: string
  label: string
  type?: 'text' | 'number' | 'date'
  readOnly?: boolean
}

export type ColDef = {
  label: string
  render: (row: any) => React.ReactNode
  className?: string
}

type Props = {
  title: string
  entity: string  // URL slug, e.g. 'ingredientes'
  fields: FieldDef[]
  columns: ColDef[]
}

const BTN = {
  base: { fontFamily: 'DM Mono, monospace', fontSize: 12, border: 'none', cursor: 'pointer', borderRadius: 10, padding: '8px 16px' } as React.CSSProperties,
}

export default function CRUDPage({ title, entity, fields, columns }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/data/${entity}?limit=5000`)
    const json = await res.json()
    setRows(json.data || [])
    setCount(json.count || 0)
    setLoading(false)
  }, [entity])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm(Object.fromEntries(fields.filter(f => !f.readOnly).map(f => [f.key, ''])))
    setMsg('')
    setModalOpen(true)
  }

  function openEdit(row: any) {
    setEditing(row)
    setForm(Object.fromEntries(fields.filter(f => !f.readOnly).map(f => [f.key, row[f.key] ?? ''])))
    setMsg('')
    setModalOpen(true)
  }

  async function save() {
    setSaving(true)
    setMsg('')
    const body: Record<string, any> = {}
    for (const [k, v] of Object.entries(form)) {
      const def = fields.find(f => f.key === k)
      body[k] = def?.type === 'number' ? (v === '' ? null : Number(v)) : (v || null)
    }

    const url = editing ? `/api/data/${entity}/${editing.id}` : `/api/data/${entity}`
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (!res.ok) { setMsg(json.error || 'Error'); setSaving(false); return }
    setModalOpen(false)
    await load()
    setSaving(false)
  }

  async function remove(row: any) {
    if (!confirm(`Eliminar este registro?`)) return
    await fetch(`/api/data/${entity}/${row.id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="p-8">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{count.toLocaleString('es-ES')} registros</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#3d3834" strokeWidth={2} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 10, border: '1.5px solid #e8e2db', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', outline: 'none', backgroundColor: '#fff', width: 200 }}
              onFocus={e => e.currentTarget.style.borderColor = '#19f973'}
              onBlur={e => e.currentTarget.style.borderColor = '#e8e2db'}
            />
          </div>
          <button onClick={openAdd} style={{ ...BTN.base, backgroundColor: '#19f973', color: '#2a2522', fontWeight: 600, fontSize: 13, padding: '10px 20px' }}>
            + Nuevo
          </button>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty-state"><p className="page-subtitle">Cargando...</p></div>
        ) : rows.length === 0 ? (
          <div className="empty-state"><p className="page-subtitle">Sin registros. Usa el boton "Nuevo" o importa datos desde Ajustes.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((c, i) => <th key={i}>{c.label}</th>)}
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.filter(row => {
                  if (!search.trim()) return true
                  const q = search.toLowerCase()
                  return Object.values(row).some(v => v != null && String(v).toLowerCase().includes(q))
                }).map(row => (
                  <tr key={row.id}>
                    {columns.map((c, i) => (
                      <td key={i} className={c.className}>{c.render(row)}</td>
                    ))}
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(row)} style={{ ...BTN.base, backgroundColor: '#f5f2ee', color: '#3d3834', padding: '5px 10px', fontSize: 11 }}>Editar</button>
                        <button onClick={() => remove(row)} style={{ ...BTN.base, backgroundColor: '#fef2f2', color: '#dc2626', padding: '5px 10px', fontSize: 11 }}>x</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 18, color: '#3d3834', margin: '0 0 24px' }}>
              {editing ? 'Editar registro' : `Nuevo ${title.toLowerCase().replace('s', '').trim()}`}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {fields.filter(f => !f.readOnly).map(f => (
                <div key={f.key}>
                  <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.6, display: 'block', marginBottom: 5 }}>{f.label}</label>
                  <input
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    value={form[f.key] ?? ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    step={f.type === 'number' ? 'any' : undefined}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e8e2db', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#3d3834', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#19f973'}
                    onBlur={e => e.currentTarget.style.borderColor = '#e8e2db'}
                  />
                </div>
              ))}
            </div>
            {msg && <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#dc2626', marginTop: 14 }}>{msg}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalOpen(false)} style={{ ...BTN.base, backgroundColor: '#f5f2ee', color: '#3d3834' }}>Cancelar</button>
              <button onClick={save} disabled={saving} style={{ ...BTN.base, backgroundColor: '#19f973', color: '#2a2522', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
