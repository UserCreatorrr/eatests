'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Plato {
  nombre: string
  categoria?: string
  precio_venta: number | null
  descripcion?: string
}

interface IngredienteExt {
  nombre: string
  unidad: string | null
  precio_unitario: number
  vendor: string | null
}

interface ProveedorExt {
  nombre: string
  nif: string | null
}

interface LineaPropuesta {
  ingrediente: string
  cantidad: number
  unidad: string
  precio_unitario: number
  coste: number
  confianza: 'alta' | 'media' | 'baja'
  incluida: boolean
}

interface RecetaPropuesta {
  plato: string
  precio_venta: number | null
  raciones_estimadas: number
  lineas: LineaPropuesta[]
  coste_total: number
  food_cost_pct: number | null
  incluida: boolean
}

type Paso = 1 | 2 | 3 | 4 | 5

const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)

function filesToBase64(files: FileList): Promise<string[]> {
  return Promise.all(Array.from(files).map(f => new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(f)
  })))
}

export default function OnboardingPage() {
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1 — Carta
  const [cartaImages, setCartaImages] = useState<string[]>([])
  const [platos, setPlatos] = useState<Plato[]>([])

  // Step 2 — Facturas
  const [facturaImages, setFacturaImages] = useState<string[]>([])
  const [ingredientes, setIngredientes] = useState<IngredienteExt[]>([])
  const [proveedores, setProveedores] = useState<ProveedorExt[]>([])

  // Step 3 — Match
  const [recetas, setRecetas] = useState<RecetaPropuesta[]>([])

  // Step 5 — Resumen
  const [resumen, setResumen] = useState<any>(null)

  const cartaInputRef = useRef<HTMLInputElement>(null)
  const facturaInputRef = useRef<HTMLInputElement>(null)

  async function handleCartaFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return
    const b64 = await filesToBase64(e.target.files)
    setCartaImages(prev => [...prev, ...b64])
    e.target.value = ''
  }

  async function handleFacturaFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return
    const b64 = await filesToBase64(e.target.files)
    setFacturaImages(prev => [...prev, ...b64])
    e.target.value = ''
  }

  async function procesarCarta() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/onboarding/parse-carta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: cartaImages }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setPlatos(data.platos || [])
      setPaso(2)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function procesarFacturas() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/onboarding/parse-facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: facturaImages }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setIngredientes(data.ingredientes || [])
      setProveedores(data.proveedores || [])
      setPaso(3)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function ejecutarMatch() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/onboarding/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platos, ingredientes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      const enriched: RecetaPropuesta[] = (data.propuestas || []).map((p: any) => ({
        ...p,
        incluida: p.lineas.length > 0,
        lineas: p.lineas.map((l: any) => ({ ...l, incluida: l.confianza !== 'baja' })),
      }))
      setRecetas(enriched)
      setPaso(4)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function commit() {
    setLoading(true); setError('')
    try {
      // Filtrar líneas no incluidas y recalcular costes
      const recetasFinal = recetas
        .filter(r => r.incluida)
        .map(r => ({
          plato: r.plato,
          precio_venta: r.precio_venta,
          raciones_estimadas: r.raciones_estimadas,
          lineas: r.lineas
            .filter(l => l.incluida)
            .map(l => ({
              ingrediente: l.ingrediente,
              cantidad: l.cantidad,
              unidad: l.unidad,
              precio_unitario: l.precio_unitario,
            })),
        }))
        .filter(r => r.lineas.length > 0)

      const res = await fetch('/api/onboarding/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proveedores, ingredientes, recetas: recetasFinal }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setResumen(data.resumen)
      setPaso(5)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  function toggleReceta(idx: number) {
    setRecetas(prev => prev.map((r, i) => i === idx ? { ...r, incluida: !r.incluida } : r))
  }

  function toggleLinea(rIdx: number, lIdx: number) {
    setRecetas(prev => prev.map((r, i) => {
      if (i !== rIdx) return r
      const newLineas = r.lineas.map((l, j) => j === lIdx ? { ...l, incluida: !l.incluida } : l)
      const costeTotal = newLineas.filter(l => l.incluida).reduce((s, l) => s + l.coste, 0)
      return {
        ...r,
        lineas: newLineas,
        coste_total: Math.round(costeTotal * 100) / 100,
        food_cost_pct: r.precio_venta ? Math.round((costeTotal / r.precio_venta) * 100) : null,
      }
    }))
  }

  function updateLineaCantidad(rIdx: number, lIdx: number, cantidad: number) {
    setRecetas(prev => prev.map((r, i) => {
      if (i !== rIdx) return r
      const newLineas = r.lineas.map((l, j) => {
        if (j !== lIdx) return l
        const coste = cantidad * l.precio_unitario
        return { ...l, cantidad, coste: Math.round(coste * 10000) / 10000 }
      })
      const costeTotal = newLineas.filter(l => l.incluida).reduce((s, l) => s + l.coste, 0)
      return {
        ...r,
        lineas: newLineas,
        coste_total: Math.round(costeTotal * 100) / 100,
        food_cost_pct: r.precio_venta ? Math.round((costeTotal / r.precio_venta) * 100) : null,
      }
    }))
  }

  const confColors = {
    alta:  { bg: '#dcfce7', text: '#15803d' },
    media: { bg: '#fef3c7', text: '#92400e' },
    baja:  { bg: '#fee2e2', text: '#991b1b' },
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f2ee', padding: '40px 24px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>

        {/* Header con progreso */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 28, color: '#3d3834', margin: '0 0 6px' }}>
            Configura tu cocina en 5 minutos
          </h1>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#9c958f', margin: '0 0 20px' }}>
            Sube tu carta y unas facturas — la IA monta el escandallo por ti
          </p>
          {/* Stepper */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} style={{
                flex: 1, height: 4, borderRadius: 2,
                backgroundColor: n <= paso ? '#19f973' : '#e8e2db',
                transition: 'background-color 0.3s',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'DM Mono, monospace', fontSize: 9.5, color: '#9c958f' }}>
            <span style={{ color: paso >= 1 ? '#3d3834' : undefined, fontWeight: paso === 1 ? 700 : 400 }}>1. Carta</span>
            <span style={{ color: paso >= 2 ? '#3d3834' : undefined, fontWeight: paso === 2 ? 700 : 400 }}>2. Facturas</span>
            <span style={{ color: paso >= 3 ? '#3d3834' : undefined, fontWeight: paso === 3 ? 700 : 400 }}>3. Cruce IA</span>
            <span style={{ color: paso >= 4 ? '#3d3834' : undefined, fontWeight: paso === 4 ? 700 : 400 }}>4. Validar</span>
            <span style={{ color: paso >= 5 ? '#3d3834' : undefined, fontWeight: paso === 5 ? 700 : 400 }}>5. Listo</span>
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontFamily: 'DM Mono, monospace', fontSize: 11 }}>
            {error}
          </div>
        )}

        {/* ====== PASO 1 — CARTA ====== */}
        {paso === 1 && (
          <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 28, border: '1px solid #e8e2db' }}>
            <h2 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 18, color: '#3d3834', margin: '0 0 8px' }}>
              Sube fotos de tu carta
            </h2>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11.5, color: '#6b6560', margin: '0 0 22px' }}>
              Haz fotos a las páginas de tu carta o sube imágenes. La IA leerá los platos y precios.
            </p>

            <div
              onClick={() => cartaInputRef.current?.click()}
              style={{
                border: '2px dashed #c9c2bb', borderRadius: 12, padding: '32px 16px',
                textAlign: 'center', cursor: 'pointer', backgroundColor: '#faf9f7',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#19f973'; (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f0fdf4' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#c9c2bb'; (e.currentTarget as HTMLDivElement).style.backgroundColor = '#faf9f7' }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
              <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 14, color: '#3d3834', margin: '0 0 4px' }}>
                Pulsa para añadir imágenes
              </p>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9c958f', margin: 0 }}>
                JPG, PNG · varias páginas a la vez
              </p>
              <input ref={cartaInputRef} type="file" accept="image/*" multiple onChange={handleCartaFiles} style={{ display: 'none' }} />
            </div>

            {cartaImages.length > 0 && (
              <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {cartaImages.map((img, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={img} alt="" style={{ height: 80, borderRadius: 8, border: '1px solid #e8e2db' }} />
                    <button
                      onClick={() => setCartaImages(prev => prev.filter((_, j) => j !== i))}
                      style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', backgroundColor: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11 }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                onClick={procesarCarta}
                disabled={cartaImages.length === 0 || loading}
                style={{
                  padding: '10px 22px', backgroundColor: cartaImages.length === 0 || loading ? '#e8e2db' : '#19f973',
                  border: 'none', borderRadius: 10, cursor: cartaImages.length === 0 || loading ? 'default' : 'pointer',
                  fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 700, color: '#2a2522',
                }}
              >
                {loading ? 'Analizando carta…' : 'Extraer platos →'}
              </button>
            </div>
          </div>
        )}

        {/* ====== PASO 2 — FACTURAS ====== */}
        {paso === 2 && (
          <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 28, border: '1px solid #e8e2db' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 18, color: '#3d3834', margin: '0 0 4px' }}>
                  Platos extraídos ({platos.length})
                </h2>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6b6560', margin: 0 }}>
                  Ahora sube facturas/albaranes recientes para conocer tus ingredientes.
                </p>
              </div>
            </div>

            {platos.length > 0 && (
              <div style={{ marginBottom: 24, maxHeight: 180, overflowY: 'auto', border: '1px solid #f0ebe4', borderRadius: 10, padding: 12 }}>
                {platos.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: 'DM Mono, monospace', fontSize: 11 }}>
                    <span style={{ color: '#3d3834' }}>{p.nombre}</span>
                    <span style={{ color: '#9c958f' }}>{p.precio_venta ? fmt(p.precio_venta) : '—'}</span>
                  </div>
                ))}
              </div>
            )}

            <div
              onClick={() => facturaInputRef.current?.click()}
              style={{
                border: '2px dashed #c9c2bb', borderRadius: 12, padding: '28px 16px',
                textAlign: 'center', cursor: 'pointer', backgroundColor: '#faf9f7',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>🧾</div>
              <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 13, color: '#3d3834', margin: '0 0 4px' }}>
                Sube facturas o albaranes
              </p>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9c958f', margin: 0 }}>
                Mínimo 3–5 facturas representativas para cubrir tu compra habitual
              </p>
              <input ref={facturaInputRef} type="file" accept="image/*" multiple onChange={handleFacturaFiles} style={{ display: 'none' }} />
            </div>

            {facturaImages.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {facturaImages.map((img, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={img} alt="" style={{ height: 64, borderRadius: 8, border: '1px solid #e8e2db' }} />
                    <button
                      onClick={() => setFacturaImages(prev => prev.filter((_, j) => j !== i))}
                      style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10 }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button onClick={() => setPaso(1)} style={{ padding: '10px 22px', backgroundColor: 'transparent', border: '1.5px solid #d8d0c8', borderRadius: 10, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 600, color: '#6b6560' }}>
                ← Atrás
              </button>
              <button
                onClick={procesarFacturas}
                disabled={facturaImages.length === 0 || loading}
                style={{ padding: '10px 22px', backgroundColor: facturaImages.length === 0 || loading ? '#e8e2db' : '#19f973', border: 'none', borderRadius: 10, cursor: facturaImages.length === 0 || loading ? 'default' : 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 700, color: '#2a2522' }}
              >
                {loading ? 'Analizando facturas…' : 'Extraer ingredientes →'}
              </button>
            </div>
          </div>
        )}

        {/* ====== PASO 3 — MATCH ====== */}
        {paso === 3 && (
          <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 28, border: '1px solid #e8e2db' }}>
            <h2 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 18, color: '#3d3834', margin: '0 0 6px' }}>
              Resumen previo al cruce
            </h2>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6b6560', margin: '0 0 22px' }}>
              La IA va a deducir qué ingredientes lleva cada plato y proponerte el escandallo.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 22 }}>
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 22, color: '#15803d', margin: '0 0 2px' }}>{platos.length}</p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#15803d', margin: 0 }}>platos detectados</p>
              </div>
              <div style={{ backgroundColor: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 22, color: '#1e40af', margin: '0 0 2px' }}>{ingredientes.length}</p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#1e40af', margin: 0 }}>ingredientes únicos</p>
              </div>
              <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 22, color: '#92400e', margin: '0 0 2px' }}>{proveedores.length}</p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#92400e', margin: 0 }}>proveedores</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setPaso(2)} style={{ padding: '10px 22px', backgroundColor: 'transparent', border: '1.5px solid #d8d0c8', borderRadius: 10, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 600, color: '#6b6560' }}>
                ← Atrás
              </button>
              <button
                onClick={ejecutarMatch}
                disabled={loading}
                style={{ padding: '10px 22px', backgroundColor: loading ? '#e8e2db' : '#19f973', border: 'none', borderRadius: 10, cursor: loading ? 'default' : 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 700, color: '#2a2522' }}
              >
                {loading ? 'Cruzando platos con ingredientes…' : 'Cruzar con IA →'}
              </button>
            </div>
          </div>
        )}

        {/* ====== PASO 4 — VALIDAR ====== */}
        {paso === 4 && (
          <div>
            <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '20px 24px', marginBottom: 14, border: '1px solid #e8e2db', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 16, color: '#3d3834', margin: '0 0 2px' }}>
                  Escandallo propuesto
                </h2>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10.5, color: '#6b6560', margin: 0 }}>
                  Desmarca lo que no sea correcto. Ajusta cantidades si quieres. Confianza: <span style={{ color: '#15803d', fontWeight: 700 }}>alta</span> · <span style={{ color: '#92400e', fontWeight: 700 }}>media</span> · <span style={{ color: '#991b1b', fontWeight: 700 }}>baja</span>
                </p>
              </div>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', backgroundColor: '#f5f2ee', padding: '5px 11px', borderRadius: 8 }}>
                {recetas.filter(r => r.incluida).length} / {recetas.length} activas
              </span>
            </div>

            {recetas.map((r, rIdx) => (
              <div key={rIdx} style={{
                backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden',
                border: `1px solid ${r.incluida ? '#e8e2db' : '#f0ebe4'}`,
                opacity: r.incluida ? 1 : 0.55,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', backgroundColor: '#faf9f7', borderBottom: '1px solid #f0ebe4' }}>
                  <input type="checkbox" checked={r.incluida} onChange={() => toggleReceta(rIdx)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#3d3834', margin: '0 0 1px' }}>{r.plato}</p>
                    <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9c958f', margin: 0 }}>
                      Coste {fmt(r.coste_total)}
                      {r.precio_venta && <> · PVP {fmt(r.precio_venta)}</>}
                      {r.food_cost_pct != null && <> · FC <span style={{ fontWeight: 700, color: r.food_cost_pct > 35 ? '#dc2626' : r.food_cost_pct > 28 ? '#d97706' : '#15803d' }}>{r.food_cost_pct}%</span></>}
                    </p>
                  </div>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6b6560' }}>
                    {r.lineas.filter(l => l.incluida).length}/{r.lineas.length} ingr.
                  </span>
                </div>
                {r.incluida && r.lineas.length > 0 && (
                  <div style={{ padding: '6px 16px 12px' }}>
                    {r.lineas.map((l, lIdx) => (
                      <div key={lIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: lIdx < r.lineas.length - 1 ? '1px solid #f5f2ee' : 'none' }}>
                        <input type="checkbox" checked={l.incluida} onChange={() => toggleLinea(rIdx, lIdx)} style={{ width: 14, height: 14, cursor: 'pointer' }} />
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 600, color: '#3d3834', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.ingrediente}
                        </span>
                        <input
                          type="number"
                          value={l.cantidad}
                          onChange={e => updateLineaCantidad(rIdx, lIdx, parseFloat(e.target.value) || 0)}
                          step="0.01"
                          style={{ width: 60, padding: '3px 6px', fontFamily: 'DM Mono, monospace', fontSize: 10.5, border: '1px solid #d8d0c8', borderRadius: 5, textAlign: 'right' }}
                        />
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9c958f', minWidth: 30 }}>{l.unidad}</span>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10.5, color: '#3d3834', minWidth: 60, textAlign: 'right' as const }}>
                          {fmt(l.coste)}
                        </span>
                        <span style={{
                          fontFamily: 'DM Mono, monospace', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.05em',
                          padding: '2px 6px', borderRadius: 4,
                          backgroundColor: confColors[l.confianza].bg, color: confColors[l.confianza].text,
                        }}>
                          {l.confianza.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button onClick={() => setPaso(3)} style={{ padding: '10px 22px', backgroundColor: 'transparent', border: '1.5px solid #d8d0c8', borderRadius: 10, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 600, color: '#6b6560' }}>
                ← Atrás
              </button>
              <button
                onClick={commit}
                disabled={loading}
                style={{ padding: '10px 22px', backgroundColor: loading ? '#e8e2db' : '#19f973', border: 'none', borderRadius: 10, cursor: loading ? 'default' : 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 700, color: '#2a2522' }}
              >
                {loading ? 'Guardando…' : 'Confirmar y guardar →'}
              </button>
            </div>
          </div>
        )}

        {/* ====== PASO 5 — LISTO ====== */}
        {paso === 5 && resumen && (
          <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 36, border: '1px solid #e8e2db', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 22, color: '#3d3834', margin: '0 0 8px' }}>
              Tu cocina está lista
            </h2>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#6b6560', margin: '0 0 28px' }}>
              Hemos creado todo lo que necesitas para empezar.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, maxWidth: 480, margin: '0 auto 28px' }}>
              <div style={{ backgroundColor: '#f0fdf4', borderRadius: 10, padding: 14, border: '1px solid #86efac' }}>
                <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 22, color: '#15803d', margin: 0 }}>{resumen.recetas_creadas}</p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#15803d', margin: '2px 0 0' }}>recetas con escandallo</p>
              </div>
              <div style={{ backgroundColor: '#eff6ff', borderRadius: 10, padding: 14, border: '1px solid #93c5fd' }}>
                <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 22, color: '#1e40af', margin: 0 }}>{resumen.ingredientes.creados + resumen.ingredientes.actualizados}</p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#1e40af', margin: '2px 0 0' }}>ingredientes con coste</p>
              </div>
              <div style={{ backgroundColor: '#fef3c7', borderRadius: 10, padding: 14, border: '1px solid #fcd34d' }}>
                <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 22, color: '#92400e', margin: 0 }}>{resumen.proveedores.creados}</p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#92400e', margin: '2px 0 0' }}>proveedores nuevos</p>
              </div>
              <div style={{ backgroundColor: '#f5f3ff', borderRadius: 10, padding: 14, border: '1px solid #c4b5fd' }}>
                <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 22, color: '#6d28d9', margin: 0 }}>{resumen.lineas_escandallo}</p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6d28d9', margin: '2px 0 0' }}>líneas de escandallo</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => router.push('/dashboard/sangrado')} style={{ padding: '11px 22px', backgroundColor: '#3d3834', color: '#dfd5c9', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 700 }}>
                Ver escandallo
              </button>
              <button onClick={() => router.push('/dashboard')} style={{ padding: '11px 22px', backgroundColor: '#19f973', color: '#2a2522', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 700 }}>
                Ir a la cocina →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
