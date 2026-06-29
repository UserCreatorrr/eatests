'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { tk, ff } from '@/lib/design'
import { ALMACENES } from '@/lib/catalog'

interface Ingrediente { id: number; descr: string; unit: string | null; cost: number | null }
interface Registro {
  id: number; nombre: string; cantidad: number | null; unidad: string | null
  motivo: string | null; coste_estimado: number | null; fecha: string
  servicio?: string | null; almacen?: string | null; site_id?: string | null; tipo?: string | null; notas?: string | null
}

const MOTIVOS = ['caducidad', 'sobreproducción', 'error cocina', 'devolución', 'mala recepción', 'rotura', 'staff meal', 'otro']
const SERVICIOS = ['Desayuno', 'Comida', 'Cena', 'Entre servicios', 'Prep']
const UNIDADES = ['kg', 'g', 'l', 'ml', 'ud']

const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)

export default function MermaPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [stats, setStats] = useState<{ totalMes: any; topProductos: any[]; statsMes: any[] }>({ totalMes: { t: 0, n: 0 }, topProductos: [], statsMes: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const hoy = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    tipo: 'ingrediente' as 'ingrediente' | 'receta',
    ingrediente_id: '' as string,
    nombre: '', cantidad: '', unidad: '', motivo: 'caducidad',
    servicio: 'Comida', almacen: '', site_id: '', fecha: hoy, notas: '',
  })

  async function load() {
    const [m, ing] = await Promise.all([
      fetch('/api/merma').then(r => r.json()).catch(() => ({})),
      fetch('/api/data/ingredientes?limit=500').then(r => r.json()).catch(() => ({ data: [] })),
    ])
    setRegistros(m.registros || [])
    setStats({ totalMes: m.totalMes || { t: 0, n: 0 }, topProductos: m.topProductos || [], statsMes: m.statsMes || [] })
    setIngredientes(ing.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Coste estimado en vivo
  const ingSel = ingredientes.find(i => String(i.id) === form.ingrediente_id)
  const costePreview = (() => {
    const cant = parseFloat(form.cantidad)
    if (!cant || !ingSel?.cost) return null
    const f = unitMini(form.unidad || ingSel.unit, ingSel.unit)
    return Math.round(cant * f * ingSel.cost * 100) / 100
  })()

  function onIngSelect(id: string) {
    const ing = ingredientes.find(i => String(i.id) === id)
    setForm(s => ({ ...s, ingrediente_id: id, nombre: ing?.descr || s.nombre, unidad: ing?.unit || s.unidad, almacen: s.almacen }))
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.cantidad) return
    setSaving(true)
    await fetch('/api/merma', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: form.nombre.trim(),
        ingrediente_id: form.ingrediente_id ? Number(form.ingrediente_id) : null,
        cantidad: parseFloat(form.cantidad) || null,
        unidad: form.unidad || null,
        motivo: form.motivo, servicio: form.servicio, almacen: form.almacen || null,
        site_id: form.site_id || null, tipo: form.tipo, fecha: form.fecha,
        notas: form.notas || null,
      }),
    })
    setForm(s => ({ ...s, ingrediente_id: '', nombre: '', cantidad: '', unidad: '', notas: '' }))
    await load()
    setSaving(false)
  }

  async function borrar(id: number) {
    if (!confirm('¿Eliminar este registro de merma?')) return
    await fetch('/api/merma', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  return (
    <div style={{ padding: '32px 36px 60px' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.2em', color: tk.appleDeep, textTransform: 'uppercase', margin: '0 0 8px' }}>
          FOOD COST · MERMA / DESPERDICIO
        </p>
        <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 36, lineHeight: 1.0, letterSpacing: '-0.02em', margin: '0 0 6px', color: tk.iron }}>
          ¿Qué pérdida tienes que controlar?
        </h1>
        <p style={{ fontFamily: ff.mono, fontSize: 12.5, color: tk.iron60, margin: 0 }}>
          Registra pérdidas de ingredientes o platos. Calcula su coste automáticamente y alimenta el Food Cost real.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: `1.5px solid ${tk.iron}`, marginBottom: 20 }}>
        <Kpi label="MERMA ESTE MES" value={fmt(stats.totalMes?.t || 0)} sub={`${stats.totalMes?.n || 0} eventos`} variant={(stats.totalMes?.t || 0) > 300 ? 'crit' : (stats.totalMes?.t || 0) > 100 ? 'warn' : 'default'} />
        <Kpi label="TOP MOTIVO" value={stats.statsMes?.[0]?.motivo ? cap(stats.statsMes[0].motivo) : '—'} sub={stats.statsMes?.[0] ? fmt(stats.statsMes[0].coste_total || 0) : 'sin datos'} />
        <Kpi label="REGISTROS" value={String(registros.length)} sub="histórico reciente" last />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, alignItems: 'start' }}>
        {/* FORM registro */}
        <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}` }}>
          <div style={panelHead}>Registrar merma</div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Tipo */}
            <div style={{ display: 'flex', gap: 0, border: `1.5px solid ${tk.iron}`, width: 'fit-content' }}>
              {(['ingrediente', 'receta'] as const).map(t => (
                <button key={t} onClick={() => setForm(s => ({ ...s, tipo: t }))} style={{
                  padding: '6px 14px', background: form.tipo === t ? tk.iron : tk.paper, color: form.tipo === t ? tk.cream : tk.iron,
                  border: 'none', cursor: 'pointer', fontFamily: ff.mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase',
                  borderLeft: t === 'receta' ? `1.5px solid ${tk.iron}` : 'none',
                }}>{t === 'ingrediente' ? 'Ingrediente' : 'Plato / receta'}</button>
              ))}
            </div>

            {form.tipo === 'ingrediente' ? (
              <Field label="Ingrediente">
                <select value={form.ingrediente_id} onChange={e => onIngSelect(e.target.value)} style={inputStyle}>
                  <option value="">— buscar en catálogo —</option>
                  {ingredientes.map(i => <option key={i.id} value={i.id}>{i.descr}{i.cost ? ` · ${i.cost}€/${i.unit || 'ud'}` : ''}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Nombre del plato">
                <input value={form.nombre} onChange={e => setForm(s => ({ ...s, nombre: e.target.value }))} placeholder="Ej: Salmón a la plancha" style={inputStyle} />
              </Field>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Cantidad"><input type="number" step="0.01" value={form.cantidad} onChange={e => setForm(s => ({ ...s, cantidad: e.target.value }))} style={inputStyle} /></Field>
              <Field label="Unidad">
                <select value={form.unidad} onChange={e => setForm(s => ({ ...s, unidad: e.target.value }))} style={inputStyle}>
                  <option value="">—</option>{UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Motivo">
                <select value={form.motivo} onChange={e => setForm(s => ({ ...s, motivo: e.target.value }))} style={inputStyle}>
                  {MOTIVOS.map(m => <option key={m} value={m}>{cap(m)}</option>)}
                </select>
              </Field>
              <Field label="Servicio">
                <select value={form.servicio} onChange={e => setForm(s => ({ ...s, servicio: e.target.value }))} style={inputStyle}>
                  {SERVICIOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Almacén">
                <select value={form.almacen} onChange={e => setForm(s => ({ ...s, almacen: e.target.value }))} style={inputStyle}>
                  <option value="">—</option>{ALMACENES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Fecha"><input type="date" value={form.fecha} onChange={e => setForm(s => ({ ...s, fecha: e.target.value }))} style={inputStyle} /></Field>
            </div>

            <Field label="Comentario (opcional)"><input value={form.notas} onChange={e => setForm(s => ({ ...s, notas: e.target.value }))} placeholder="Contexto…" style={inputStyle} /></Field>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontFamily: ff.mono, fontSize: 11.5, color: tk.iron60 }}>
                Coste estimado: <strong style={{ color: costePreview ? tk.iron : tk.iron40, fontFamily: ff.display, fontWeight: 600, fontSize: 15 }}>{costePreview != null ? fmt(costePreview) : '—'}</strong>
              </span>
              <button onClick={guardar} disabled={saving || !form.cantidad || (form.tipo === 'ingrediente' ? !form.ingrediente_id : !form.nombre.trim())}
                style={{ padding: '9px 18px', background: tk.apple, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: tk.iron, letterSpacing: '0.06em', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'GUARDANDO…' : 'REGISTRAR MERMA →'}
              </button>
            </div>
          </div>
        </div>

        {/* Top productos */}
        <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}` }}>
          <div style={panelHead}>Top productos con merma · este mes</div>
          {stats.topProductos.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', fontFamily: ff.mono, fontSize: 11, color: tk.iron40 }}>SIN MERMA REGISTRADA ESTE MES</div>
          ) : (
            <table style={tbl}>
              <thead><tr><Th>Producto</Th><Th align="right">Eventos</Th><Th align="right">Coste</Th></tr></thead>
              <tbody>
                {stats.topProductos.map((p, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                    <Td>{p.nombre}</Td><Td align="right">{p.eventos}</Td><Td align="right">{fmt(p.coste_total || 0)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Histórico */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}` }}>
        <div style={panelHead}>Histórico de merma</div>
        {loading ? (
          <div style={{ padding: 24, fontFamily: ff.mono, fontSize: 12, color: tk.iron60 }}>Cargando…</div>
        ) : registros.length === 0 ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', fontFamily: ff.mono, fontSize: 11, color: tk.iron40 }}>SIN REGISTROS. AÑADE EL PRIMERO ARRIBA.</div>
        ) : (
          <table style={tbl}>
            <thead><tr><Th>Fecha</Th><Th>Producto</Th><Th>Cantidad</Th><Th>Motivo</Th><Th>Servicio</Th><Th>Almacén</Th><Th align="right">Coste</Th><Th align="right"></Th></tr></thead>
            <tbody>
              {registros.map(r => (
                <tr key={r.id} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                  <Td>{r.fecha}</Td>
                  <Td>{r.nombre}</Td>
                  <Td>{r.cantidad ?? '—'} {r.unidad || ''}</Td>
                  <Td>{r.motivo ? cap(r.motivo) : '—'}</Td>
                  <Td>{r.servicio || '—'}</Td>
                  <Td>{r.almacen || '—'}</Td>
                  <Td align="right">{r.coste_estimado != null ? fmt(r.coste_estimado) : '—'}</Td>
                  <Td align="right">
                    <button onClick={() => borrar(r.id)} style={{ padding: '3px 8px', background: tk.terraSoft, border: `1px solid ${tk.terra}`, color: tk.terra, cursor: 'pointer', fontFamily: ff.mono, fontSize: 11 }}>×</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// Mini factor de unidad (cliente): g→kg, ml→l
function unitMini(a: string | null | undefined, b: string | null | undefined): number {
  const x = (a || '').toLowerCase(), y = (b || '').toLowerCase()
  if (x === y || !x || !y) return 1
  if (x === 'g' && y === 'kg') return 0.001
  if (x === 'ml' && y === 'l') return 0.001
  if (x === 'kg' && y === 'g') return 1000
  if (x === 'l' && y === 'ml') return 1000
  return 1
}
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: tk.iron40, marginBottom: 5 }}>{label}</div>{children}</div>
}
function Kpi({ label, value, sub, variant = 'default', last }: { label: string; value: string; sub: string; variant?: 'default' | 'warn' | 'crit'; last?: boolean }) {
  const c = variant === 'crit' ? tk.terra : variant === 'warn' ? tk.clay : tk.iron
  return (
    <div style={{ padding: '18px 22px', borderRight: last ? 'none' : `1.5px solid ${tk.iron20}`, background: tk.paper }}>
      <div style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.15em', color: tk.iron40, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 28, lineHeight: 1.05, color: c, margin: '6px 0 3px', letterSpacing: '-0.015em' }}>{value}</div>
      <div style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60 }}>{sub}</div>
    </div>
  )
}
function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return <th style={{ padding: '8px 14px', textAlign: align, fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase', fontWeight: 400, background: tk.creamSoft, borderBottom: `1px solid ${tk.iron20}` }}>{children}</th>
}
function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <td style={{ padding: '8px 14px', textAlign: align, color: tk.iron, fontFamily: ff.mono, fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>{children}</td>
}

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: `1.5px solid ${tk.iron20}`, background: tk.cream, color: tk.iron, fontFamily: ff.mono, fontSize: 12, outline: 'none' }
const panelHead: React.CSSProperties = { padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.iron, textTransform: 'uppercase' }
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
