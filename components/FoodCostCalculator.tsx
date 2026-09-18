'use client'

import { useState, useEffect } from 'react'
import { unidadesCompatibles, unidadesCompatiblesCon, dimensionUnidad } from '@/lib/foodcost'

type Linea = {
  id: number
  ingrediente_id: number | null
  subreceta_id: number | null
  nombre_libre: string | null
  cantidad: number
  unidad: string | null
  coste_unitario: number | null
  merma_pct: number
  ing_nombre: string | null
  ing_coste: number | null
  ing_unidad: string | null
  sub_nombre: string | null
  sub_unidad_producida: string | null
  // Calculado en el servidor: es el único que resuelve subrecetas y merma
  cantidad_bruta: number
  coste_calculado: number
  coste_unitario_efectivo: number
  tipo: 'ingrediente' | 'subreceta' | 'libre'
  aviso: string | null
}

type Resumen = {
  coste_total: number
  coste_racion: number
  food_cost_pct: number | null
  lineas_incompletas: number
  ciclo: boolean
}

type Ingrediente = { id: number; descr: string; cost: number | null; unit: string | null }
type Subreceta = { id: number; nombre: string; cantidad_producida: number | null; unidad_producida: string | null; coste_unidad_producida: number | null }

type Props = {
  recetaId: number
  recetaNombre: string
  precioVenta: number | null
  raciones?: number | null
  esSubreceta?: boolean | number | null
  cantidadProducida?: number | null
  unidadProducida?: string | null
  onClose: () => void
  onSaved?: () => void
  onAbrirSubreceta?: (id: number) => void
  embedded?: boolean
}

// Unidades cómodas para cocina (feedback P1): el sistema convierte solo
// (150 g de un ingrediente a €/kg → 0,15 kg) sin obligar a pensar en decimales.
// El desplegable se filtra por la MAGNITUD del ingrediente elegido, para que no
// se pueda pedir "14 ud" de algo que se controla en kg.
const UNIDADES_COCINA = ['g', 'kg', 'ml', 'cl', 'l', 'ud', 'docena']

function eur(v: number | null | undefined) {
  if (v == null) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v)
}

function num(v: number) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(v)
}

function foodCostBadge(pct: number) {
  if (pct < 28) return { label: 'EXCELENTE', bg: '#d6f9e0', color: '#0fa651' }
  if (pct < 33) return { label: 'ACEPTABLE', bg: '#fcf2e8', color: '#c97b3d' }
  if (pct < 40) return { label: 'REVISAR', bg: '#fff7ed', color: '#c97b3d' }
  return { label: 'CRITICO', bg: '#fbeae2', color: '#a83e1e' }
}

// Colores de la distribución de coste. Se repiten a partir del séptimo, que es
// más de lo que nadie mira en un gráfico de tarta.
const COLORES_COSTE = ['#19f973', '#c97b3d', '#5b44b8', '#0fa651', '#a83e1e', '#6c635a', '#d4a017']

function priceDelta(l: Linea): number | null {
  if (l.ingrediente_id == null || l.coste_unitario == null || l.ing_coste == null) return null
  if (Math.abs(l.ing_coste - l.coste_unitario) < 0.00005) return null
  return Math.round(((l.ing_coste - l.coste_unitario) / l.coste_unitario) * 100)
}

export default function FoodCostCalculator({
  recetaId, recetaNombre, precioVenta, raciones,
  esSubreceta, cantidadProducida, unidadProducida,
  onClose, onSaved, onAbrirSubreceta, embedded,
}: Props) {
  const [lineas, setLineas] = useState<Linea[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [subrecetas, setSubrecetas] = useState<Subreceta[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [usarLibre, setUsarLibre] = useState(false)
  // Cierre financiero de la receta (feedback P0): PVP y raciones editables aquí mismo
  const [pvp, setPvp] = useState<string>(precioVenta != null ? String(precioVenta) : '')
  const [rac, setRac] = useState<string>(raciones != null && raciones > 0 ? String(raciones) : '1')
  // Producción: convierte esta receta en una elaboración reutilizable
  const [esElab, setEsElab] = useState<boolean>(!!esSubreceta)
  const [prodCant, setProdCant] = useState<string>(cantidadProducida != null ? String(cantidadProducida) : '')
  const [prodUnidad, setProdUnidad] = useState<string>(unidadProducida || 'g')
  const [savingReceta, setSavingReceta] = useState(false)
  const [errorUnidad, setErrorUnidad] = useState('')
  const [recetaGuardada, setRecetaGuardada] = useState(false)
  const [nueva, setNueva] = useState({
    ingrediente_id: '',
    subreceta_id: '',
    nombre_libre: '',
    cantidad: '',
    unidad: '',
    coste_unitario: '',
    merma_pct: '',
  })

  async function loadLineas() {
    const res = await fetch(`/api/recetas/${recetaId}/lineas`).then(r => r.json()).catch(() => ({ lineas: [] }))
    setLineas(res.lineas || [])
    setResumen(res.resumen || null)
  }

  async function loadSubrecetas() {
    const res = await fetch(`/api/recetas/${recetaId}/subrecetas`).then(r => r.json()).catch(() => ({ subrecetas: [] }))
    setSubrecetas(res.subrecetas || [])
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadLineas(),
      loadSubrecetas(),
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

  async function cambiarMerma(lineaId: number, valor: string) {
    const n = valor === '' ? 0 : parseFloat(valor)
    if (!Number.isFinite(n) || n < 0 || n > 95) return
    // Optimista: la fila responde al instante y el servidor recalcula el coste.
    setLineas(ls => ls.map(l => (l.id === lineaId ? { ...l, merma_pct: n } : l)))
    await fetch(`/api/recetas/${recetaId}/lineas/${lineaId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merma_pct: n }),
    })
    await loadLineas()
  }

  async function addLinea() {
    if (!nueva.cantidad || parseFloat(nueva.cantidad) <= 0) return
    setErrorUnidad('')

    const body: any = {
      cantidad: parseFloat(nueva.cantidad),
      unidad: nueva.unidad || null,
      merma_pct: nueva.merma_pct ? parseFloat(nueva.merma_pct) : 0,
    }

    if (nueva.subreceta_id) {
      const sub = subrecetas.find(s => s.id === parseInt(nueva.subreceta_id))
      if (sub && !unidadesCompatibles(nueva.unidad, sub.unidad_producida)) {
        setErrorUnidad(`«${sub.nombre}» se produce en ${sub.unidad_producida} y estás usando ${nueva.unidad}. Elige una unidad de la misma magnitud.`)
        return
      }
      body.subreceta_id = parseInt(nueva.subreceta_id)
    } else if (usarLibre) {
      body.nombre_libre = nueva.nombre_libre || 'Sin nombre'
      if (nueva.coste_unitario) body.coste_unitario = parseFloat(nueva.coste_unitario)
    } else {
      // No se permite guardar una línea cuya unidad no es de la misma magnitud que
      // la del ingrediente: daría un coste sin sentido (14 ud x 20 €/kg = 280 €).
      const ing = ingredientes.find(i => i.id === parseInt(nueva.ingrediente_id))
      if (ing && !unidadesCompatibles(nueva.unidad, ing.unit)) {
        setErrorUnidad(`«${ing.descr}» se controla en ${ing.unit} y estás usando ${nueva.unidad}. Elige una unidad de la misma magnitud o cambia la unidad base del ingrediente.`)
        return
      }
      body.ingrediente_id = parseInt(nueva.ingrediente_id)
      if (nueva.coste_unitario) body.coste_unitario = parseFloat(nueva.coste_unitario)
    }

    setSaving(true)
    const res = await fetch(`/api/recetas/${recetaId}/lineas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setErrorUnidad(err.error || 'No se ha podido añadir la línea.')
      setSaving(false)
      return
    }
    setNueva({ ingrediente_id: '', subreceta_id: '', nombre_libre: '', cantidad: '', unidad: '', coste_unitario: '', merma_pct: '' })
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
    setErrorUnidad('')
    setNueva(n => ({
      ...n,
      ingrediente_id: id,
      subreceta_id: '',
      // Si la unidad actual no es de la magnitud del ingrediente, se sustituye
      unidad: (n.unidad && unidadesCompatibles(n.unidad, ing?.unit)) ? n.unidad : (ing?.unit || ''),
      coste_unitario: ing?.cost ? String(ing.cost) : n.coste_unitario,
    }))
  }

  function onSubSelect(id: string) {
    const sub = subrecetas.find(s => s.id === parseInt(id))
    setErrorUnidad('')
    setNueva(n => ({
      ...n,
      subreceta_id: id,
      ingrediente_id: '',
      unidad: (n.unidad && unidadesCompatibles(n.unidad, sub?.unidad_producida)) ? n.unidad : (sub?.unidad_producida || ''),
      coste_unitario: '',
    }))
  }

  async function guardarReceta() {
    setSavingReceta(true)
    await fetch(`/api/data/escandallo-receta/${recetaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        precio_venta: pvp !== '' ? parseFloat(pvp) : null,
        raciones: rac !== '' ? parseInt(rac) : null,
        es_subreceta: esElab ? 1 : 0,
        cantidad_producida: esElab && prodCant !== '' ? parseFloat(prodCant) : null,
        unidad_producida: esElab && prodCant !== '' ? prodUnidad : null,
      }),
    })
    setSavingReceta(false)
    setRecetaGuardada(true)
    setTimeout(() => setRecetaGuardada(false), 2500)
    await loadSubrecetas()
    onSaved?.()
  }

  // Unidades ofrecidas: solo las de la magnitud de lo que se ha seleccionado
  const ingSeleccionado = !usarLibre && nueva.ingrediente_id
    ? ingredientes.find(i => i.id === parseInt(nueva.ingrediente_id))
    : null
  const subSeleccionada = nueva.subreceta_id ? subrecetas.find(s => s.id === parseInt(nueva.subreceta_id)) : null
  const unidadReferencia = subSeleccionada ? subSeleccionada.unidad_producida : ingSeleccionado?.unit
  const unidadesPermitidas = unidadReferencia && dimensionUnidad(unidadReferencia)
    ? unidadesCompatiblesCon(unidadReferencia).map(u => u.code)
    : UNIDADES_COCINA

  // El coste lo manda el servidor (resuelve subrecetas anidadas y merma).
  // PVP y raciones sí son locales: se ven al instante mientras se teclean.
  const costeTotal = resumen?.coste_total ?? 0

  const pvpNum = pvp !== '' ? parseFloat(pvp) : null
  const racNum = rac !== '' && parseInt(rac) > 0 ? parseInt(rac) : 1
  const costeRacion = costeTotal / racNum
  const foodCostPct = pvpNum && pvpNum > 0 ? (costeRacion / pvpNum) * 100 : null
  const margen = pvpNum != null ? pvpNum - costeRacion : null
  const margenPct = pvpNum && pvpNum > 0 ? ((pvpNum - costeRacion) / pvpNum) * 100 : null
  const pvpSugerido = costeRacion > 0 ? Math.ceil((costeRacion / 0.30) * 100) / 100 : null
  const badge = foodCostPct != null ? foodCostBadge(foodCostPct) : null

  const costePorUnidadProducida = esElab && prodCant !== '' && parseFloat(prodCant) > 0
    ? costeTotal / parseFloat(prodCant)
    : null

  // Reparto del coste por línea, de mayor a menor. Lo que no cuesta nada no
  // pinta nada, así que se descartan las líneas a cero.
  const reparto = lineas
    .filter(l => (l.coste_calculado || 0) > 0)
    .map(l => ({
      id: l.id,
      nombre: (l.tipo === 'subreceta' ? l.sub_nombre : l.ingrediente_id ? l.ing_nombre : l.nombre_libre) || 'Sin nombre',
      pct: costeTotal > 0 ? (l.coste_calculado / costeTotal) * 100 : 0,
    }))
    .sort((a, b) => b.pct - a.pct)

  const lineasConDelta = lineas.filter(l => priceDelta(l) !== null)
  const hasPriceChanges = lineasConDelta.length > 0
  const lineasConAviso = lineas.filter(l => l.aviso)
  const hayMerma = lineas.some(l => (l.merma_pct ?? 0) > 0)

  const sumLabel: React.CSSProperties = { fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 4px', letterSpacing: 1 }
  const sumValue: React.CSSProperties = { fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 22, color: '#3d3834', margin: 0 }
  const tdStyle: React.CSSProperties = { padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', borderBottom: '1px solid #e8e2db' }
  const thStyle: React.CSSProperties = { padding: '6px 10px', fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.45, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left', borderBottom: '1px solid #e8e2db' }
  const inputMini: React.CSSProperties = { width: 52, fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '3px 5px', border: '1px solid #e8e2db', borderRadius: 6, backgroundColor: '#fff', color: '#3d3834' }

  return (
    <div style={{ backgroundColor: embedded ? 'transparent' : '#fff', border: embedded ? 'none' : '1px solid #e8e2db', borderRadius: embedded ? 0 : 20, padding: embedded ? '24px 0 0' : 24, marginTop: embedded ? 0 : 20 }}>
      {/* Header — only shown when not embedded (standalone use) */}
      {!embedded && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 18, color: '#3d3834', margin: 0 }}>
            Food Cost: {recetaNombre}
          </h2>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, backgroundColor: '#ece4d8', color: '#6c635a', letterSpacing: '0.05em' }}>
            PRECIOS VIVOS
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3d3834', opacity: 0.4, display: 'flex', alignItems: 'center' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      )}

      {/* Referencia circular: el coste no se puede cerrar hasta deshacerla */}
      {resumen?.ciclo && (
        <div style={{ backgroundColor: '#fbeae2', border: '1px solid #a83e1e', padding: '10px 14px', marginBottom: 16 }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, color: '#a83e1e', margin: 0 }}>
            Hay una elaboración que se usa a sí misma. Quita esa línea para que el coste vuelva a cuadrar.
          </p>
        </div>
      )}

      {/* Líneas que no suman: mejor decirlo que enseñar un coste a la baja */}
      {lineasConAviso.length > 0 && (
        <div style={{ backgroundColor: '#fff7ed', border: '1px solid #c97b3d', padding: '10px 14px', marginBottom: 16 }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, color: '#c97b3d', margin: '0 0 4px' }}>
            {lineasConAviso.length} línea{lineasConAviso.length > 1 ? 's' : ''} sin coste, el total está incompleto
          </p>
          {lineasConAviso.slice(0, 4).map(l => (
            <p key={l.id} style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#c97b3d', opacity: 0.85, margin: 0 }}>· {l.aviso}</p>
          ))}
        </div>
      )}

      {/* Price-change notice */}
      {hasPriceChanges && (
        <div style={{ backgroundColor: '#fcf2e8', border: '1px solid #c97b3d', borderRadius: 0, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, color: '#c97b3d', margin: '0 0 2px' }}>
              {lineasConDelta.length} ingrediente{lineasConDelta.length > 1 ? 's' : ''} con precio actualizado
            </p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#c97b3d', opacity: 0.7, margin: 0 }}>
              El food cost refleja los precios actuales del mercado. Sincroniza para guardarlos.
            </p>
          </div>
          <button
            onClick={syncPrecios}
            disabled={syncing}
            style={{ flexShrink: 0, fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, padding: '7px 14px', backgroundColor: '#c97b3d', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', opacity: syncing ? 0.6 : 1, whiteSpace: 'nowrap' }}
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
                  {['Ingrediente', 'Neto', 'Unidad', 'Merma', 'Bruto', 'Precio/ud', 'Subtotal', ''].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineas.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', opacity: 0.4, padding: '20px 0' }}>
                      Sin ingredientes. Añade el primero abajo.
                    </td>
                  </tr>
                )}
                {lineas.map(l => {
                  const delta = priceDelta(l)
                  const isLive = l.ingrediente_id != null && l.ing_coste != null
                  const esSub = l.tipo === 'subreceta'
                  return (
                    <tr key={l.id} style={l.aviso ? { backgroundColor: '#fffaf3' } : undefined}>
                      <td style={tdStyle}>
                        <span>{esSub ? (l.sub_nombre || '-') : l.ingrediente_id ? (l.ing_nombre || '-') : (l.nombre_libre || '-')}</span>
                        {esSub && (
                          <span style={{ marginLeft: 5, fontFamily: 'DM Mono, monospace', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: '#e8e0ff', color: '#5b44b8' }}>elaboración</span>
                        )}
                        {esSub && l.subreceta_id && onAbrirSubreceta && (
                          <button
                            onClick={() => onAbrirSubreceta(l.subreceta_id as number)}
                            title={`Abrir el escandallo de ${l.sub_nombre}`}
                            style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#5b44b8', fontFamily: 'DM Mono, monospace', fontSize: 11, padding: 0 }}
                          >
                            ver ›
                          </button>
                        )}
                        {isLive && !esSub && (
                          <span style={{ marginLeft: 5, fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '1px 5px', borderRadius: 4, backgroundColor: '#ece4d8', color: '#6c635a' }}>live</span>
                        )}
                        {l.aviso && (
                          <span style={{ display: 'block', fontFamily: 'DM Mono, monospace', fontSize: 9.5, color: '#c97b3d', marginTop: 2 }}>{l.aviso}</span>
                        )}
                      </td>
                      <td style={tdStyle}>{num(l.cantidad)}</td>
                      <td style={tdStyle}>{l.unidad || l.ing_unidad || '-'}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        <input
                          type="number" min="0" max="95" step="0.1"
                          defaultValue={l.merma_pct || 0}
                          onBlur={e => { if (parseFloat(e.target.value || '0') !== (l.merma_pct || 0)) cambiarMerma(l.id, e.target.value) }}
                          style={inputMini}
                        />
                        <span style={{ marginLeft: 3, opacity: 0.45 }}>%</span>
                      </td>
                      <td style={{ ...tdStyle, opacity: (l.merma_pct ?? 0) > 0 ? 1 : 0.35 }}>
                        {num(l.cantidad_bruta ?? l.cantidad)}
                      </td>
                      <td style={tdStyle}>
                        <span>{l.coste_unitario_efectivo ? eur(l.coste_unitario_efectivo) : '-'}</span>
                        {delta !== null && (
                          <span style={{ marginLeft: 6, fontFamily: 'DM Mono, monospace', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: delta > 0 ? '#fbeae2' : '#d6f9e0', color: delta > 0 ? '#a83e1e' : '#0fa651' }}>
                            {delta > 0 ? '+' : ''}{delta}%
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{l.coste_calculado ? eur(l.coste_calculado) : '-'}</td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => borrarLinea(l.id)}
                          style={{ backgroundColor: '#fbeae2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#a83e1e', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 700 }}
                        >
                          x
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {lineas.length > 0 && (
                  <tr>
                    <td colSpan={6} style={{ ...tdStyle, textAlign: 'right', opacity: 0.6 }}>TOTAL</td>
                    <td style={{ ...tdStyle, fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 15, color: '#19f973' }}>{eur(costeTotal)}</td>
                    <td style={tdStyle} />
                  </tr>
                )}
              </tbody>
            </table>
            {hayMerma && (
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6c635a', margin: '8px 2px 0', lineHeight: 1.5 }}>
                La cantidad neta es la que acaba en el plato. Con la merma, el coste se calcula sobre el bruto, que es lo que sale del almacén.
              </p>
            )}
          </div>

          {/* Formulario añadir */}
          <div style={{ backgroundColor: '#faf6ec', borderRadius: 0, padding: 16, marginBottom: 20 }}>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 12px', letterSpacing: 1 }}>Añadir ingrediente o elaboración</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 200px' }}>
                {!usarLibre ? (
                  <select
                    value={nueva.subreceta_id ? `sub:${nueva.subreceta_id}` : nueva.ingrediente_id}
                    onChange={e => {
                      const v = e.target.value
                      if (v === '__libre__') { setUsarLibre(true); setNueva(n => ({ ...n, ingrediente_id: '', subreceta_id: '', coste_unitario: '' })) }
                      else if (v.startsWith('sub:')) onSubSelect(v.slice(4))
                      else onIngSelect(v)
                    }}
                    style={{ width: '100%', fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '7px 10px', border: '1px solid #e8e2db', borderRadius: 8, backgroundColor: '#fff', color: '#3d3834' }}
                  >
                    <option value="">Seleccionar...</option>
                    {subrecetas.length > 0 && (
                      <optgroup label="Elaboraciones (salsas, bases, fondos)">
                        {subrecetas.map(s => (
                          <option key={`sub-${s.id}`} value={`sub:${s.id}`}>
                            {s.nombre} — {num(s.cantidad_producida || 0)} {s.unidad_producida}
                            {s.coste_unidad_producida ? ` · ${eur(s.coste_unidad_producida)}/${s.unidad_producida}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Ingredientes">
                      {ingredientes.map(i => (
                        <option key={i.id} value={i.id}>
                          {i.descr}{i.cost ? ` — ${i.cost}€/${i.unit || 'ud'}` : ''}
                        </option>
                      ))}
                    </optgroup>
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
                type="number" step="0.001" min="0" placeholder="cant. neta"
                value={nueva.cantidad}
                onChange={e => setNueva(n => ({ ...n, cantidad: e.target.value }))}
                style={{ flex: '0 1 90px', fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '7px 10px', border: '1px solid #e8e2db', borderRadius: 8, backgroundColor: '#fff', color: '#3d3834' }}
              />
              <select
                value={nueva.unidad}
                onChange={e => setNueva(n => ({ ...n, unidad: e.target.value }))}
                style={{ flex: '0 1 90px', fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '7px 10px', border: '1px solid #e8e2db', borderRadius: 8, backgroundColor: '#fff', color: '#3d3834' }}
              >
                <option value="">unidad…</option>
                {unidadesPermitidas.map(u => <option key={u} value={u}>{u}</option>)}
                {nueva.unidad && !unidadesPermitidas.includes(nueva.unidad) && <option value={nueva.unidad}>{nueva.unidad}</option>}
              </select>
              <input
                type="number" step="0.1" min="0" max="95" placeholder="merma %"
                value={nueva.merma_pct}
                onChange={e => setNueva(n => ({ ...n, merma_pct: e.target.value }))}
                title="Porcentaje que se pierde al limpiar o cocinar"
                style={{ flex: '0 1 90px', fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '7px 10px', border: '1px solid #e8e2db', borderRadius: 8, backgroundColor: '#fff', color: '#3d3834' }}
              />
              {!nueva.subreceta_id && (
                <input
                  type="number" step="0.0001" min="0" placeholder="€/ud (auto)"
                  value={nueva.coste_unitario}
                  onChange={e => setNueva(n => ({ ...n, coste_unitario: e.target.value }))}
                  style={{ flex: '0 1 110px', fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '7px 10px', border: '1px solid #e8e2db', borderRadius: 8, backgroundColor: '#fff', color: '#3d3834' }}
                />
              )}
              <button
                onClick={addLinea}
                disabled={saving || !nueva.cantidad}
                style={{ flex: '0 0 auto', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 700, padding: '7px 16px', backgroundColor: '#19f973', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#2a2522', opacity: saving ? 0.6 : 1 }}
              >
                +
              </button>
            </div>
            {errorUnidad && (
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#a83e1e', margin: '10px 0 0', lineHeight: 1.45 }}>
                ⚠ {errorUnidad}
              </p>
            )}
          </div>

          {/* Distribución del coste: en qué se va el dinero del plato.
              Es lo que TSpoonLab enseña en tarta; aquí va en barra porque se
              lee igual de bien y no obliga a cargar una librería de gráficos. */}
          {reparto.length > 0 && costeTotal > 0 && (
            <div style={{ backgroundColor: '#faf6ec', padding: 16, marginBottom: 20 }}>
              <p style={{ ...sumLabel, marginBottom: 10 }}>Distribución del coste</p>
              <div style={{ display: 'flex', height: 18, overflow: 'hidden', border: '1px solid #e8e2db' }}>
                {reparto.map((r, i) => (
                  <div key={r.id} title={`${r.nombre}: ${r.pct.toFixed(1)}%`}
                    style={{ width: `${r.pct}%`, backgroundColor: COLORES_COSTE[i % COLORES_COSTE.length] }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10 }}>
                {reparto.map((r, i) => (
                  <span key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'DM Mono, monospace', fontSize: 10.5, color: '#3d3834' }}>
                    <span style={{ width: 9, height: 9, backgroundColor: COLORES_COSTE[i % COLORES_COSTE.length], flexShrink: 0 }} />
                    {r.nombre} <strong>{r.pct.toFixed(1)}%</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Producción: hace que esta receta se pueda usar dentro de otras */}
          <div style={{ backgroundColor: '#faf6ec', borderRadius: 0, padding: 16, marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={esElab} onChange={e => setEsElab(e.target.checked)} />
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11.5, color: '#3d3834' }}>
                Es una elaboración intermedia (salsa, fondo, base) que se usa en otras recetas
              </span>
            </label>
            {esElab && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 12 }}>
                <div>
                  <p style={sumLabel}>Esta receta produce</p>
                  <input
                    type="number" step="0.001" min="0" placeholder="2000"
                    value={prodCant}
                    onChange={e => setProdCant(e.target.value)}
                    style={{ width: 100, fontFamily: 'DM Mono, monospace', fontSize: 12, padding: '7px 10px', border: '1px solid #e8e2db', borderRadius: 8, backgroundColor: '#fff', color: '#3d3834' }}
                  />
                </div>
                <select
                  value={prodUnidad}
                  onChange={e => setProdUnidad(e.target.value)}
                  style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, padding: '7px 10px', border: '1px solid #e8e2db', borderRadius: 8, backgroundColor: '#fff', color: '#3d3834' }}
                >
                  {UNIDADES_COCINA.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                {costePorUnidadProducida != null && (
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6c635a', margin: '0 0 8px' }}>
                    Coste: <strong>{eur(costePorUnidadProducida)}</strong> por {prodUnidad}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Cierre financiero: PVP + raciones editables → coste/ración, FC%, márgenes */}
          <div style={{ backgroundColor: '#faf6ec', borderRadius: 0, padding: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', marginBottom: 18 }}>
              <div>
                <p style={sumLabel}>Precio de venta / ración (€)</p>
                <input
                  type="number" step="0.01" min="0" placeholder="0.00"
                  value={pvp}
                  onChange={e => setPvp(e.target.value)}
                  style={{ width: 110, fontFamily: 'DM Mono, monospace', fontSize: 13, padding: '8px 10px', border: '1.5px solid #c4b8a8', borderRadius: 0, backgroundColor: '#fff', color: '#3d3834', outline: 'none' }}
                />
              </div>
              <div>
                <p style={sumLabel}>Raciones</p>
                <input
                  type="number" step="1" min="1"
                  value={rac}
                  onChange={e => setRac(e.target.value)}
                  style={{ width: 70, fontFamily: 'DM Mono, monospace', fontSize: 13, padding: '8px 10px', border: '1.5px solid #c4b8a8', borderRadius: 0, backgroundColor: '#fff', color: '#3d3834', outline: 'none' }}
                />
              </div>
              <button
                onClick={guardarReceta}
                disabled={savingReceta}
                style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, padding: '9px 16px', backgroundColor: recetaGuardada ? '#d6f9e0' : '#19f973', border: '1.5px solid #3d3834', borderRadius: 0, cursor: 'pointer', color: recetaGuardada ? '#0fa651' : '#2a2522', opacity: savingReceta ? 0.6 : 1 }}
              >
                {savingReceta ? 'GUARDANDO…' : recetaGuardada ? '✓ GUARDADO' : 'GUARDAR FICHA'}
              </button>
              {pvpSugerido != null && (
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10.5, color: '#6c635a', margin: '0 0 8px' }}>
                  PVP sugerido (FC 30%): <strong>{eur(pvpSugerido)}</strong>
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              <div>
                <p style={sumLabel}>Coste total receta</p>
                <p style={sumValue}>{eur(costeTotal)}</p>
              </div>
              <div>
                <p style={sumLabel}>Coste / ración</p>
                <p style={sumValue}>{eur(costeRacion)}</p>
              </div>
              {/* Lo que cuesta un gramo (o un mililitro) de esta elaboración:
                  es el número con el que entra en las recetas que la usan. */}
              {costePorUnidadProducida != null && (
                <div>
                  <p style={sumLabel}>Coste / {prodUnidad} producido</p>
                  <p style={sumValue}>{eur(costePorUnidadProducida)}</p>
                </div>
              )}
              {foodCostPct != null && badge && (
                <div>
                  <p style={sumLabel}>Food Cost %</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <p style={sumValue}>{foodCostPct.toFixed(1)}%</p>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span>
                  </div>
                </div>
              )}
              {margen != null && (
                <div>
                  <p style={sumLabel}>Margen bruto / ración</p>
                  <p style={{ ...sumValue, color: margen >= 0 ? '#0fa651' : '#a83e1e' }}>
                    {eur(margen)} {margenPct != null ? `(${margenPct.toFixed(1)}%)` : ''}
                  </p>
                </div>
              )}
              {margen != null && racNum > 1 && (
                <div>
                  <p style={sumLabel}>Margen total ({racNum} raciones)</p>
                  <p style={{ ...sumValue, color: margen >= 0 ? '#0fa651' : '#a83e1e' }}>{eur(margen * racNum)}</p>
                </div>
              )}
              {foodCostPct == null && (
                <div>
                  <p style={sumLabel}>Food Cost %</p>
                  <p style={{ ...sumValue, opacity: 0.4, fontSize: 14 }}>Define el precio de venta para cerrar la rentabilidad</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
