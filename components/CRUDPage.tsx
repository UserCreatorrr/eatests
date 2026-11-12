'use client'
// Listado + alta/edición genéricos sobre un endpoint v2 (GET lista, POST alta,
// PATCH edición, DELETE baja). Para pantallas sencillas; las que tienen
// lógica propia (ingredientes, albaranes…) montan su página.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { Btn, Field, Input, Modal, Page, Panel, SearchBox, Select, Table, Td, Tr, Empty, Loading } from './ui'

export type FieldDef = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'select' | 'checkbox'; options?: { value: string; label: string }[]; required?: boolean; hint?: string }
export type ColDef = { label: string; render: (row: any) => ReactNode; right?: boolean }

type Props = {
  title: string; eyebrow?: string; subtitle?: ReactNode
  endpoint: string
  /** Filtro de lista en la query string, p. ej. "kind=invoice". */
  query?: string
  fields: FieldDef[]
  columns: ColDef[]
  /** Convierte el formulario (strings) en el cuerpo que espera el servidor. */
  toBody: (form: Record<string, string>, editing: any | null) => Record<string, unknown>
  /** Rellena el formulario desde una fila. */
  fromRow?: (row: any) => Record<string, string>
  canDelete?: boolean
  actions?: ReactNode
  singular?: string
  rowHref?: (row: any) => string
}

export default function CRUDPage({ title, eyebrow, subtitle, endpoint, query, fields, columns, toBody, fromRow, canDelete = true, actions, singular, rowHref }: Props) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await api.get(`${endpoint}${query ? '?' + query : ''}`); setRows(r.data ?? []) } catch (e) { setMsg(errorMessage(e)) }
    setLoading(false)
  }, [endpoint, query])
  useEffect(() => { load() }, [load])

  function open(row: any | null) {
    setEditing(row); setMsg('')
    setForm(row ? (fromRow ? fromRow(row) : Object.fromEntries(fields.map(f => [f.key, row[f.key] == null ? '' : String(row[f.key])]))) : Object.fromEntries(fields.map(f => [f.key, ''])))
    setModal(true)
  }

  async function save() {
    setSaving(true); setMsg('')
    try {
      if (editing) await api.patch(`${endpoint}/${editing.id}`, toBody(form, editing))
      else await api.post(endpoint, toBody(form, null))
      setModal(false); await load()
    } catch (e) { setMsg(errorMessage(e)) }
    setSaving(false)
  }

  async function remove(row: any) {
    if (!confirm('¿Eliminar este registro?')) return
    try { await api.del(`${endpoint}/${row.id}`); await load() } catch (e) { alert(errorMessage(e)) }
  }

  const q = search.trim().toLowerCase()
  const visible = q ? rows.filter(r => Object.values(r).some(v => v != null && String(v).toLowerCase().includes(q))) : rows

  return (
    <Page eyebrow={eyebrow} title={title} subtitle={subtitle ?? `${rows.length.toLocaleString('es-ES')} registros`} actions={<>{actions}<SearchBox value={search} onChange={setSearch} /><Btn onClick={() => open(null)}>+ NUEVO</Btn></>}>
      <Panel>
        {loading ? <Loading /> : visible.length === 0 ? <Empty>{rows.length === 0 ? 'Sin registros todavía.' : 'Sin resultados para la búsqueda.'}</Empty> : (
          <Table head={[...columns.map(c => c.label), '']} right={columns.map((c, i) => c.right ? i : -1).filter(i => i >= 0)}>
            {visible.map(row => (
              <Tr key={row.id}>
                {columns.map((c, i) => <Td key={i} right={c.right}>{c.render(row)}</Td>)}
                <Td right>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    {rowHref && <Btn small kind="ghost" href={rowHref(row)}>VER</Btn>}
                    <Btn small kind="ghost" onClick={() => open(row)}>EDITAR</Btn>
                    {canDelete && <Btn small kind="danger" onClick={() => remove(row)}>×</Btn>}
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Panel>
      {msg && !modal && <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.terra }}>{msg}</p>}

      {modal && (
        <Modal title={editing ? `Editar ${singular ?? 'registro'}` : `Nuevo ${singular ?? 'registro'}`} onClose={() => setModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {fields.map(f => (
              <div key={f.key} style={{ gridColumn: f.type === 'checkbox' || fields.length < 4 ? '1 / -1' : undefined }}>
                <Field label={f.label + (f.required ? ' *' : '')} hint={f.hint}>
                  {f.type === 'select' ? (
                    <Select value={form[f.key] ?? ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                      <option value="">—</option>
                      {(f.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  ) : f.type === 'checkbox' ? (
                    <label style={{ fontFamily: ff.mono, fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form[f.key] === '1'} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.checked ? '1' : '0' }))} /> Sí
                    </label>
                  ) : (
                    <Input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} step={f.type === 'number' ? 'any' : undefined} value={form[f.key] ?? ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  )}
                </Field>
              </div>
            ))}
          </div>
          {msg && <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.terra, margin: '14px 0 0' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
            <Btn kind="ghost" onClick={() => setModal(false)}>CANCELAR</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'GUARDANDO…' : 'GUARDAR'}</Btn>
          </div>
        </Modal>
      )}
    </Page>
  )
}

/** Helpers para toBody: '' → null, números y booleanos. */
export const F = {
  str: (v: string | undefined) => (v && v.trim() ? v.trim() : null),
  num: (v: string | undefined) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null),
  bool: (v: string | undefined) => v === '1',
}
