'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { tk, ff } from '@/lib/design'

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

const BTN: React.CSSProperties = {
  fontFamily: ff.mono, fontSize: 12, border: 'none', cursor: 'pointer', padding: '8px 16px',
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
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '20px 24px', borderBottom: `1.5px solid ${tk.iron20}` }}>
          <div>
            <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 24, color: tk.iron, margin: 0, letterSpacing: '-0.015em' }}>{title}</h1>
            <p style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, margin: '3px 0 0', letterSpacing: '0.04em' }}>{count.toLocaleString('es-ES')} registros</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={tk.iron} strokeWidth={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 12, color: tk.iron, outline: 'none', backgroundColor: tk.cream, width: 200 }}
                onFocus={e => e.currentTarget.style.borderColor = tk.iron}
                onBlur={e => e.currentTarget.style.borderColor = tk.iron20}
              />
            </div>
            <button onClick={openAdd} style={{ ...BTN, backgroundColor: tk.apple, color: tk.iron, fontWeight: 600, fontSize: 12, padding: '9px 18px', border: `1.5px solid ${tk.iron}`, letterSpacing: '0.06em' }}>
              + NUEVO
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}><p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.iron60 }}>Cargando…</p></div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}><p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.iron60 }}>Sin registros. Usa el botón "Nuevo" o importa datos desde Ajustes.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: ff.mono, fontSize: 12 }}>
              <thead>
                <tr>
                  {columns.map((c, i) => <th key={i} style={thStyle}>{c.label}</th>)}
                  <th style={{ ...thStyle, width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.filter(row => {
                  if (!search.trim()) return true
                  const q = search.toLowerCase()
                  return Object.values(row).some(v => v != null && String(v).toLowerCase().includes(q))
                }).map(row => (
                  <tr key={row.id} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                    {columns.map((c, i) => (
                      <td key={i} className={c.className} style={tdStyle}>{c.render(row)}</td>
                    ))}
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(row)} style={{ ...BTN, backgroundColor: tk.creamSoft, color: tk.iron, padding: '5px 10px', fontSize: 10.5, border: `1px solid ${tk.iron20}`, letterSpacing: '0.06em' }}>EDITAR</button>
                        <button onClick={() => remove(row)} style={{ ...BTN, backgroundColor: tk.terraSoft, color: tk.terra, padding: '5px 10px', fontSize: 11, border: `1px solid ${tk.terra}` }}>×</button>
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(61,56,52,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ backgroundColor: tk.paper, border: `1.5px solid ${tk.iron}`, padding: 0, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ background: tk.iron, color: tk.cream, padding: '14px 24px' }}>
              <h2 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 16, color: tk.cream, margin: 0, letterSpacing: '-0.01em' }}>
                {editing ? 'Editar registro' : `Nuevo ${title.toLowerCase().replace(/s$/, '').trim()}`}
              </h2>
            </div>
            <div style={{ padding: 28 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {fields.filter(f => !f.readOnly).map(f => (
                  <div key={f.key}>
                    <label style={{ fontFamily: ff.mono, fontSize: 9.5, color: tk.iron40, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{f.label}</label>
                    <input
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      value={form[f.key] ?? ''}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      step={f.type === 'number' ? 'any' : undefined}
                      style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 13, color: tk.iron, outline: 'none', boxSizing: 'border-box', backgroundColor: tk.cream }}
                      onFocus={e => e.currentTarget.style.borderColor = tk.iron}
                      onBlur={e => e.currentTarget.style.borderColor = tk.iron20}
                    />
                  </div>
                ))}
              </div>
              {msg && <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.terra, marginTop: 14 }}>{msg}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                <button onClick={() => setModalOpen(false)} style={{ ...BTN, backgroundColor: tk.paper, color: tk.iron, border: `1.5px solid ${tk.iron}`, letterSpacing: '0.06em' }}>CANCELAR</button>
                <button onClick={save} disabled={saving} style={{ ...BTN, backgroundColor: tk.apple, color: tk.iron, fontWeight: 600, border: `1.5px solid ${tk.iron}`, opacity: saving ? 0.6 : 1, letterSpacing: '0.06em' }}>
                  {saving ? 'GUARDANDO…' : 'GUARDAR'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase', fontWeight: 400, background: tk.creamSoft, borderBottom: `1.5px solid ${tk.iron20}` }
const tdStyle: React.CSSProperties = { padding: '9px 16px', color: tk.iron, fontFamily: ff.mono, fontSize: 12 }
