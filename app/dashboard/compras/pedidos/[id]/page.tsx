'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { tk, ff } from '@/lib/design'
import { ALMACENES } from '@/lib/catalog'

interface Ing { id: number; descr: string; unit: string | null; cost: number | null }
interface Linea {
  id: number; ingrediente_id: number | null; nombre: string | null
  cantidad: number | null; unidad: string | null; coste_estimado: number | null; almacen_destino: string | null
  ing_nombre?: string | null
}

const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
const unitMini = (a: string | null, b: string | null) => {
  const x = (a || '').toLowerCase(), y = (b || '').toLowerCase()
  if (x === y || !x || !y) return 1
  if (x === 'g' && y === 'kg') return 0.001
  if (x === 'ml' && y === 'l') return 0.001
  return 1
}

export default function PedidoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const [pedido, setPedido] = useState<any>(null)
  const [lineas, setLineas] = useState<Linea[]>([])
  const [total, setTotal] = useState(0)
  const [ingredientes, setIngredientes] = useState<Ing[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nueva, setNueva] = useState({ ingrediente_id: '', nombre: '', cantidad: '', unidad: '', almacen_destino: '' })

  async function load() {
    const [d, ing] = await Promise.all([
      fetch(`/api/pedidos/${id}/lineas`).then(r => r.json()).catch(() => null),
      fetch('/api/data/ingredientes?limit=500').then(r => r.json()).catch(() => ({ data: [] })),
    ])
    if (d && !d.error) { setPedido(d.pedido); setLineas(d.lineas || []); setTotal(d.total_estimado || 0) }
    setIngredientes(ing.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  const ingSel = ingredientes.find(i => String(i.id) === nueva.ingrediente_id)
  const costePreview = (() => {
    const c = parseFloat(nueva.cantidad)
    if (!c || !ingSel?.cost) return null
    return Math.round(c * unitMini(nueva.unidad || ingSel.unit, ingSel.unit) * ingSel.cost * 100) / 100
  })()

  function onIng(idv: string) {
    const ing = ingredientes.find(i => String(i.id) === idv)
    setNueva(s => ({ ...s, ingrediente_id: idv, nombre: ing?.descr || '', unidad: ing?.unit || s.unidad }))
  }

  async function addLinea() {
    if (!nueva.cantidad || (!nueva.ingrediente_id && !nueva.nombre.trim())) return
    setSaving(true)
    await fetch(`/api/pedidos/${id}/lineas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingrediente_id: nueva.ingrediente_id ? Number(nueva.ingrediente_id) : null,
        nombre: nueva.nombre || null, cantidad: parseFloat(nueva.cantidad) || null,
        unidad: nueva.unidad || null, almacen_destino: nueva.almacen_destino || null,
      }),
    })
    setNueva({ ingrediente_id: '', nombre: '', cantidad: '', unidad: '', almacen_destino: '' })
    await load(); setSaving(false)
  }

  async function delLinea(lid: number) {
    await fetch(`/api/pedidos/${id}/lineas`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ linea_id: lid }) })
    await load()
  }

  if (loading) return <div style={{ padding: 36, fontFamily: ff.mono, color: tk.iron60 }}>Cargando…</div>
  if (!pedido) return <div style={{ padding: 36, fontFamily: ff.mono, color: tk.terra }}>Pedido no encontrado</div>

  return (
    <div style={{ padding: '32px 36px 60px', maxWidth: 920 }}>
      <Link href="/dashboard/compras/pedidos" style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, textDecoration: 'none' }}>← Pedidos</Link>

      <div style={{ background: tk.iron, color: tk.cream, padding: '18px 24px', marginTop: 12, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.apple, margin: '0 0 6px', textTransform: 'uppercase' }}>PEDIDO DE COMPRA</p>
          <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 24, margin: 0 }}>{pedido.num_order || '(sin número)'}</h1>
          <p style={{ fontFamily: ff.mono, fontSize: 11.5, opacity: 0.65, margin: '6px 0 0' }}>
            {[pedido.vendor, pedido.date_order].filter(Boolean).join(' · ') || 'Sin proveedor / fecha'}
          </p>
        </div>
        <div style={{ textAlign: 'right' as const }}>
          <p style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', opacity: 0.5, textTransform: 'uppercase', margin: 0 }}>Total estimado</p>
          <p style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 26, color: tk.apple, margin: '4px 0 0' }}>{fmt(total)}</p>
          <p style={{ fontFamily: ff.mono, fontSize: 10.5, opacity: 0.5, margin: '2px 0 0' }}>{lineas.length} línea{lineas.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Líneas */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 16 }}>
        <div style={{ padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.iron, textTransform: 'uppercase' }}>Líneas del pedido</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: ff.mono, fontSize: 11.5 }}>
          <thead><tr>
            {['Producto', 'Cantidad', 'Unidad', 'Almacén destino', 'Coste estimado', ''].map((h, i) => (
              <th key={h} style={{ padding: '8px 14px', textAlign: i === 4 ? 'right' : 'left', fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.1em', color: tk.iron40, textTransform: 'uppercase', fontWeight: 400, background: tk.creamSoft, borderBottom: `1px solid ${tk.iron20}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {lineas.length === 0 && <tr><td colSpan={6} style={{ padding: '22px', textAlign: 'center', color: tk.iron40, fontFamily: ff.mono, fontSize: 11 }}>Sin líneas. Añade el primer producto abajo.</td></tr>}
            {lineas.map(l => (
              <tr key={l.id} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                <td style={td}>{l.ing_nombre || l.nombre || '—'}</td>
                <td style={td}>{l.cantidad ?? '—'}</td>
                <td style={td}>{l.unidad || '—'}</td>
                <td style={td}>{l.almacen_destino || '—'}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{l.coste_estimado != null ? fmt(l.coste_estimado) : '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}><button onClick={() => delLinea(l.id)} style={{ padding: '3px 8px', background: tk.terraSoft, border: `1px solid ${tk.terra}`, color: tk.terra, cursor: 'pointer', fontFamily: ff.mono, fontSize: 11 }}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Añadir línea */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, padding: 16 }}>
        <div style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase', marginBottom: 10 }}>Añadir producto</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.7fr 1.2fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <select value={nueva.ingrediente_id} onChange={e => onIng(e.target.value)} style={inp}>
              <option value="">— ingrediente del catálogo —</option>
              {ingredientes.map(i => <option key={i.id} value={i.id}>{i.descr}{i.cost ? ` · ${i.cost}€/${i.unit || 'ud'}` : ''}</option>)}
            </select>
          </div>
          <input type="number" step="0.01" placeholder="Cant." value={nueva.cantidad} onChange={e => setNueva(s => ({ ...s, cantidad: e.target.value }))} style={inp} />
          <input type="text" placeholder="Ud." value={nueva.unidad} onChange={e => setNueva(s => ({ ...s, unidad: e.target.value }))} style={inp} />
          <select value={nueva.almacen_destino} onChange={e => setNueva(s => ({ ...s, almacen_destino: e.target.value }))} style={inp}>
            <option value="">Almacén destino…</option>
            {ALMACENES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={addLinea} disabled={saving || !nueva.cantidad} style={{ padding: '8px 16px', background: tk.apple, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 13, fontWeight: 600, color: tk.iron, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>+</button>
        </div>
        {costePreview != null && (
          <p style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, margin: '8px 0 0' }}>Coste estimado de la línea: <strong style={{ color: tk.iron }}>{fmt(costePreview)}</strong></p>
        )}
      </div>
    </div>
  )
}

const td: React.CSSProperties = { padding: '8px 14px', color: tk.iron, fontVariantNumeric: 'tabular-nums' }
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: `1.5px solid ${tk.iron20}`, background: tk.cream, color: tk.iron, fontFamily: ff.mono, fontSize: 11.5, outline: 'none' }
