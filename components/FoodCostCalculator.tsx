'use client'

import { useState, useEffect } from 'react'

type Linea = {
  id: number
  ingrediente_id: number | null
  nombre_libre: string | null
  cantidad: number
  unidad: string | null
  coste_unitario: number | null
  ing_nombre: string | null
  ing_coste: number | null
  ing_unidad: string | null
}

type Ingrediente = {
  id: number
  descr: string
  cost: number | null
  unit: string | null
}

type Props = {
  recetaId: number
  recetaNombre: string
  precioVenta: number | null
  onClose: () => void
}

function eur(v: number | null | undefined) {
  if (v == null) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v)
}

function foodCostBadge(pct: number) {
  if (pct < 28) return { label: 'EXCELENTE', bg: '#f0fdf4', color: '#16a34a' }
  if (pct < 33) return { label: 'ACEPTABLE', bg: '#fefce8', color: '#ca8a04' }
  if (pct < 40) return { label: 'REVISAR', bg: '#fff7ed', color: '#ea580c' }
  return { label: 'CRITICO', bg: '#fef2f2', color: '#dc2626' }
}

// Returns the effective cost to use for a line: live price when linked, stored otherwise
function effectiveCost(l: Linea): number | null {
  if (l.ingrediente_id != null) return l.ing_coste ?? l.coste_unitario
  return l.coste_unitario
}

// Returns % change between stored and live price, or null if no meaningful delta
function priceDelta(l: Linea): number | null {
  if (l.ingrediente_id == null || l.coste_unitario == null || l.ing_coste == null) return null
  if (Math.abs(l.ing_coste - l.coste_unitario) < 0.00005) return null
  return Math.round(((l.ing_coste - l.coste_unitario) / l.coste_unitario) * 100)
}

export default function FoodCostCalculator({ recetaId, recetaNombre, precioVenta, onClose }: Props) {
  const [lineas, setLineas] = useState<Linea[]>([])
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [usarLibre, setUsarLibre] = useState(false)
  const [nueva, setNueva] = useState({
    ingrediente_id: '',
    nombre_libre: '',
    cantidad: '',
    unidad: '',
    coste_unitario: '',
  })

  async function loadLineas() {
    const res = await fetch(`/api/recetas/${recetaId}/lineas`).then(r => r.json()).catch(() => ({ lineas: [] }))
    setLineas(res.lineas || [])
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadLineas(),
      fetch('/api/data/ingredientes?limit=500').then(r => r.json()).then(d => {
        const all: Ingrediente[] = d.data || []
        const conCoste = all.filter(i => i.cost && i.cost > 0)
        const sinCoste = all.filter(i => !i.cost || i.cost === 0)
        setIngredientes([...conCoste, ...sinCoste])
      }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [recetaId])

  async function borrarLinea(lineaId: number) {
    await fetch(`/api/recetas/${recetaId}/lineas/${lineaId}`, { method: 'DELETE' })
    await loadLineas()
  }

  async function addLinea() {
    if (!nueva.cantidad || parseFloat(nueva.cantidad) <= 0) return
    setSaving(true)
    const body: any = {
      cantidad: parseFloat(nueva.cantidad),
      unidad: nueva.unidad || null,
    }
    if (usarLibre) {
      body.nombre_libre = nueva.nombre_libre || 'Sin nombre'
      if (nueva.coste_unitario) body.coste_unitario = parseFloat(nueva.coste_unitario)
    } else {
      body.ingrediente_id = parseInt(nueva.ingrediente_id)
      if (nueva.coste_unitario) body.coste_unitario = parseFloat(nueva.coste_unitario)
    }
    await fetch(`/api/recetas/${recetaId}/lineas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setNueva({ ingrediente_id: '', nombre_libre: '', cantidad: '', unidad: '', coste_unitario: '' })
    await loadLineas()
    setSaving(false)
  }

  async function syncPrecios() {
    setSyncing(true)
    await fetch(`/api/recetas/${recetaId}/sync-prices`, { method: 'POST' })
    await loadLineas()
    setSyncing(false)
  }

  function onIngSelect(id: string) {
    const ing = ingredientes.find(i => i.id === parseInt(id))
    setNueva(n => ({
      ...n,
      ingrediente_id: id,
      unidad: ing?.unit || n.unidad,
      coste_unitario: ing?.cost ? String(ing.cost) : n.coste_unitario,
    }))
  }

  const costeTotal = lineas.reduce((sum, l) => {
    const cu = effectiveCost(l) ?? 0
    return sum + (l.cantidad * cu)
  }, 0)

  const foodCostPct = precioVenta && precioVenta > 0 ? (costeTotal / precioVenta) * 100 : null
  const margen = precioVenta != null ? precioVenta - costeTotal : null
  const margenPct = precioVenta && precioVenta > 0 ? ((precioVenta - costeTotal) / precioVenta) * 100 : null
  const badge = foodCostPct != null ? foodCostBadge(foodCostPct) : null

  const lineasConDelta = lineas.filter(l => priceDelta(l) !== null)
  const hasPriceChanges = lineasConDelta.length > 0

  const tdStyle: React.CSSProperties = { padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', borderBottom: '1px solid #f0ebe4' }
  const thStyle: React.CSSProperties = { padding: '6px 10px', fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.45, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left', borderBottom: '1px solid #e8e2db' }

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 20, padding: 24, marginTop: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 18, color: '#3d3834', margin: 0 }}>
            Food Cost: {recetaNombre}
          </h2>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, backgroundColor: '#f0f9ff', color: '#0369a1', letterSpacing: '0.05em' }}>
            PRECIOS VIVOS
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3d3834', opacity: 0.4, display: 'flex', alignItems: 'center' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Price-change notice */}
      {hasPriceChanges && (
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, color: '#92400e', margin: '0 0 2px' }}>
              {lineasConDelta.length} ingrediente{lineasConDelta.length > 1 ? 's' : ''} con precio actualizado
            </p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#92400e', opacity: 0.7, margin: 0 }}>
              El food cost refleja los precios actuales del mercado. Sincroniza para guardarlos.
            </p>
          </div>
          <button
            onClick={syncPrecios}
            disabled={syncing}
            style={{ flexShrink: 0, fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, padding: '7px 14px', backgroundColor: '#f59e0b', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', opacity: syncing ? 0.6 : 1, whiteSpace: 'nowrap' }}
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar precios'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.4, padding: '24px 0', textAlign: 'center' }}>Cargando...</div>
      ) : (
        <>
          {/* Tabla ingredientes */}
          <div style={{ overflowX: 'auto', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Ingrediente', 'Cantidad', 'Unidad', 'Precio/ud', 'Subtotal', ''].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineas.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', opacity: 0.4, padding: '20px 0' }}>
                      Sin ingredientes. Añade el primero abajo.
                    </td>
                  </tr>
                )}
                {lineas.map(l => {
                  const cu = effectiveCost(l)
                  const subtotal = cu != null ? l.cantidad * cu : null
                  const delta = priceDelta(l)
                  const isLive = l.ingrediente_id != null && l.ing_coste != null
                  return (
                    <tr key={l.id}>
                      <td style={tdStyle}>
                        <span>{l.ingrediente_id ? (l.ing_nombre || '-') : (l.nombre_libre || '-')}</span>
                        {isLive && (
                          <span style={{ marginLeft: 5, fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '1px 5px', borderRadius: 4, backgroundColor: '#f0f9ff', color: '#0369a1' }}>live</span>
                        )}
                      </td>
                      <td style={tdStyle}>{l.cantidad}</td>
                      <td style={tdStyle}>{l.unidad || l.ing_unidad || '-'}</td>
                      <td style={tdStyle}>
                        <span>{cu != null ? eur(cu) : '-'}</span>
                        {delta !== null && (
                          <span style={{ marginLeft: 6, fontFamily: 'DM Mono, monospace', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: delta > 0 ? '#fef2f2' : '#f0fdf4', color: delta > 0 ? '#dc2626' : '#16a34a' }}>
                            {delta > 0 ? '+' : ''}{delta}%
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{subtotal != null ? eur(subtotal) : '-'}</td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => borrarLinea(l.id)}
                          style={{ backgroundColor: '#fef2f2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#dc2626', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 700 }}
                        >
                          x
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {lineas.length > 0 && (
                  <tr>
                    <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', opacity: 0.6 }}>TOTAL</td>
                    <td style={{ ...tdStyle, fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 15, color: '#19f973' }}>{eur(costeTotal)}</td>
                    <td style={tdStyle} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Formulario añadir */}
          <div style={{ backgroundColor: '#faf9f7', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 12px', letterSpacing: 1 }}>Añadir ingrediente</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 200px' }}>
                {!usarLibre ? (
                  <select
                    value={nueva.ingrediente_id}
                    onChange={e => {
                      if (e.target.value === '__libre__') { setUsarLibre(true); setNueva(n => ({ ...n, ingrediente_id: '', coste_unitario: '' })) }
                      else onIngSelect(e.target.value)
                    }}
                    style={{ width: '100%', fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '7px 10px', border: '1px solid #e8e2db', borderRadius: 8, backgroundColor: '#fff', color: '#3d3834' }}
                  >
                    <option value="">Seleccionar ingrediente...</option>
                    {ingredientes.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.descr}{i.cost ? ` — ${i.cost}€/${i.unit || 'ud'}` : ''}
                      </option>
                    ))}
                    <option value="__libre__">Ingrediente libre (sin stock)</option>
                  </select>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      placeholder="Nombre ingrediente"
                      value={nueva.nombre_libre}
                      onChange={e => setNueva(n => ({ ...n, nombre_libre: e.target.value }))}
                      style={{ flex: 1, fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '7px 10px', border: '1px solid #e8e2db', borderRadius: 8, backgroundColor: '#fff', color: '#3d3834' }}
                    />
                    <button onClick={() => { setUsarLibre(false); setNueva(n => ({ ...n, nombre_libre: '' })) }}
                      style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, padding: '7px 10px', border: '1px solid #e8e2db', borderRadius: 8, backgroundColor: '#fff', cursor: 'pointer', color: '#3d3834', opacity: 0.5 }}>
                      Lista
                    </button>
                  </div>
                )}
              </div>
              <input
                type="number" step="0.001" min="0" placeholder="0.000"
                value={nueva.cantidad}
                onChange={e => setNueva(n => ({ ...n, cantidad: e.target.value }))}
                style={{ flex: '0 1 90px', fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '7px 10px', border: '1px solid #e8e2db', borderRadius: 8, backgroundColor: '#fff', color: '#3d3834' }}
              />
              <input
                type="text" placeholder="kg, l, ud..."
                value={nueva.unidad}
                onChange={e => setNueva(n => ({ ...n, unidad: e.target.value }))}
                style={{ flex: '0 1 80px', fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '7px 10px', border: '1px solid #e8e2db', borderRadius: 8, backgroundColor: '#fff', color: '#3d3834' }}
              />
              <input
                type="number" step="0.0001" min="0" placeholder="€/ud (auto)"
                value={nueva.coste_unitario}
                onChange={e => setNueva(n => ({ ...n, coste_unitario: e.target.value }))}
                style={{ flex: '0 1 110px', fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '7px 10px', border: '1px solid #e8e2db', borderRadius: 8, backgroundColor: '#fff', color: '#3d3834' }}
              />
              <button
                onClick={addLinea}
                disabled={saving || !nueva.cantidad}
                style={{ flex: '0 0 auto', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 700, padding: '7px 16px', backgroundColor: '#19f973', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#2a2522', opacity: saving ? 0.6 : 1 }}
              >
                +
              </button>
            </div>
          </div>

          {/* Resumen */}
          <div style={{ backgroundColor: '#faf9f7', borderRadius: 14, padding: 20, display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            <div>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 4px', letterSpacing: 1 }}>Coste total ingredientes</p>
              <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 22, color: '#3d3834', margin: 0 }}>{eur(costeTotal)}</p>
            </div>
            <div>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 4px', letterSpacing: 1 }}>Precio de venta</p>
              <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 22, color: '#3d3834', margin: 0 }}>{precioVenta != null ? eur(precioVenta) : 'Sin precio definido'}</p>
            </div>
            {foodCostPct != null && badge && (
              <div>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 4px', letterSpacing: 1 }}>Food Cost %</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 22, color: '#3d3834', margin: 0 }}>{foodCostPct.toFixed(1)}%</p>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span>
                </div>
              </div>
            )}
            {margen != null && (
              <div>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 4px', letterSpacing: 1 }}>Margen bruto</p>
                <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 22, color: margen >= 0 ? '#16a34a' : '#dc2626', margin: 0 }}>
                  {eur(margen)} {margenPct != null ? `(${margenPct.toFixed(1)}%)` : ''}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
