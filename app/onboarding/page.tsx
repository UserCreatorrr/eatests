'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { tk, ff } from '@/lib/design'

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

const CONF_BADGE: Record<'alta' | 'media' | 'baja', { bg: string; color: string; border: string; label: string }> = {
  alta:  { bg: tk.appleSoft, color: tk.appleDeep, border: tk.appleDeep, label: 'ALTA' },
  media: { bg: tk.claySoft,  color: tk.clay,      border: tk.clay,      label: 'MEDIA' },
  baja:  { bg: tk.terraSoft, color: tk.terra,     border: tk.terra,     label: 'BAJA' },
}

// Editorial icons (1.5px stroke, no fill) — mismo peso que el texto
function IconCamera() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={tk.iron} strokeWidth="1.5"><path d="M3 9h2l2-4h10l2 4h2a2 2 0 012 2v8a2 2 0 01-2 2H3a2 2 0 01-2-2v-8a2 2 0 012-2z"/><circle cx="12" cy="13" r="4"/></svg>
}
function IconInvoice() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={tk.iron} strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8"/></svg>
}
function IconCheck() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={tk.appleDeep} strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
}

export default function OnboardingPage() {
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [cartaImages, setCartaImages] = useState<string[]>([])
  const [platos, setPlatos] = useState<Plato[]>([])
  const [facturaImages, setFacturaImages] = useState<string[]>([])
  const [ingredientes, setIngredientes] = useState<IngredienteExt[]>([])
  const [proveedores, setProveedores] = useState<ProveedorExt[]>([])
  const [recetas, setRecetas] = useState<RecetaPropuesta[]>([])
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      const recetasFinal = recetas
        .filter(r => r.incluida)
        .map(r => ({
          plato: r.plato,
          precio_venta: r.precio_venta,
          raciones_estimadas: r.raciones_estimadas,
          lineas: r.lineas.filter(l => l.incluida).map(l => ({
            ingrediente: l.ingrediente, cantidad: l.cantidad, unidad: l.unidad, precio_unitario: l.precio_unitario,
          })),
        }))
        .filter(r => r.lineas.length > 0)

      const res = await fetch('/api/onboarding/commit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        ...r, lineas: newLineas,
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
        ...r, lineas: newLineas,
        coste_total: Math.round(costeTotal * 100) / 100,
        food_cost_pct: r.precio_venta ? Math.round((costeTotal / r.precio_venta) * 100) : null,
      }
    }))
  }

  // ──────────────────────────────────────────────────────────
  // Page chrome — editorial operational
  // ──────────────────────────────────────────────────────────
  const stepNames = ['Carta', 'Facturas', 'Cruce IA', 'Validar', 'Listo']

  return (
    <div style={{ minHeight: '100vh', backgroundColor: tk.creamBg, fontFamily: ff.mono, color: tk.iron }}>

      {/* Grid texture overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage:
          `linear-gradient(to right, rgba(61,56,52,0.025) 1px, transparent 1px),
           linear-gradient(to bottom, rgba(61,56,52,0.025) 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '48px 32px 80px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>

          {/* Header */}
          <header style={{ marginBottom: 32 }}>
            <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.2em', color: tk.appleDeep, textTransform: 'uppercase', margin: '0 0 10px' }}>
              CONFIGURAR CON IA · ONBOARDING ASISTIDO
            </p>
            <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 44, lineHeight: 1.0, letterSpacing: '-0.022em', margin: '0 0 10px' }}>
              Tu cocina, lista en 5 minutos.
            </h1>
            <p style={{ fontSize: 13.5, color: tk.iron60, margin: 0, maxWidth: 540, lineHeight: 1.5 }}>
              Sube tu carta y unas facturas. La IA monta el escandallo, valida coste por receta, propone PVP sugerido.
            </p>
          </header>

          {/* Stepper editorial */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
            background: tk.paper, border: `1.5px solid ${tk.iron}`,
            marginBottom: 28,
          }}>
            {stepNames.map((name, i) => {
              const n = i + 1
              const isDone = n < paso
              const isActive = n === paso
              return (
                <div key={n} style={{
                  padding: '14px 16px',
                  borderRight: i < 4 ? `1px solid ${tk.iron20}` : 'none',
                  position: 'relative' as const,
                }}>
                  {(isDone || isActive) && (
                    <div style={{ position: 'absolute' as const, top: 0, left: 0, right: 0, height: 3, background: isDone ? tk.apple : tk.iron }} />
                  )}
                  <div style={{
                    fontFamily: ff.display, fontWeight: 600, fontSize: 26, lineHeight: 1,
                    letterSpacing: '-0.02em',
                    color: isDone ? tk.appleDeep : isActive ? tk.iron : tk.iron20,
                    fontVariantNumeric: 'tabular-nums',
                  }}>{String(n).padStart(2, '0')}</div>
                  <div style={{
                    fontFamily: ff.mono, fontSize: 10.5, letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const,
                    color: isDone || isActive ? tk.iron : tk.iron40,
                    marginTop: 6,
                  }}>{name}</div>
                </div>
              )
            })}
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              background: tk.terraSoft, border: `1.5px solid ${tk.terra}`,
              padding: '10px 14px', marginBottom: 20,
              color: tk.terra, fontSize: 11.5,
            }}>{error}</div>
          )}

          {/* ────────── PASO 1 — CARTA ────────── */}
          {paso === 1 && (
            <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, padding: 32 }}>
              <h2 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 22, margin: '0 0 6px', color: tk.iron }}>
                Sube fotos de tu carta
              </h2>
              <p style={{ fontSize: 12, color: tk.iron60, margin: '0 0 24px' }}>
                Haz fotos a las páginas de tu carta. La IA leerá los platos y precios.
              </p>

              <div
                onClick={() => cartaInputRef.current?.click()}
                style={{
                  border: `1.5px dashed ${tk.iron40}`,
                  padding: '36px 16px', textAlign: 'center', cursor: 'pointer',
                  background: tk.cream, transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = tk.iron; (e.currentTarget as HTMLDivElement).style.background = tk.creamSoft }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = tk.iron40; (e.currentTarget as HTMLDivElement).style.background = tk.cream }}
              >
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><IconCamera /></div>
                <p style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 14, color: tk.iron, margin: '0 0 4px' }}>
                  Pulsa para añadir imágenes
                </p>
                <p style={{ fontSize: 10.5, color: tk.iron60, margin: 0, letterSpacing: '0.05em' }}>
                  JPG, PNG · VARIAS PÁGINAS A LA VEZ
                </p>
                <input ref={cartaInputRef} type="file" accept="image/*" multiple onChange={handleCartaFiles} style={{ display: 'none' }} />
              </div>

              {cartaImages.length > 0 && (
                <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {cartaImages.map((img, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={img} alt="" style={{ height: 80, border: `1.5px solid ${tk.iron20}`, display: 'block' }} />
                      <button
                        onClick={() => setCartaImages(prev => prev.filter((_, j) => j !== i))}
                        style={{
                          position: 'absolute', top: -8, right: -8, width: 20, height: 20,
                          background: tk.iron, color: tk.cream, border: 'none', cursor: 'pointer',
                          fontSize: 12, lineHeight: 1, fontFamily: ff.mono,
                        }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28 }}>
                <button
                  onClick={procesarCarta}
                  disabled={cartaImages.length === 0 || loading}
                  style={btnPrimary(cartaImages.length === 0 || loading)}
                >
                  {loading ? 'ANALIZANDO CARTA…' : 'EXTRAER PLATOS →'}
                </button>
              </div>
            </div>
          )}

          {/* ────────── PASO 2 — FACTURAS ────────── */}
          {paso === 2 && (
            <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, padding: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 22, margin: '0 0 4px', color: tk.iron }}>
                    {platos.length} platos extraídos
                  </h2>
                  <p style={{ fontSize: 11.5, color: tk.iron60, margin: 0 }}>
                    Ahora sube facturas/albaranes recientes para conocer tus ingredientes.
                  </p>
                </div>
              </div>

              {platos.length > 0 && (
                <div style={{
                  marginBottom: 24, maxHeight: 200, overflowY: 'auto' as const,
                  border: `1.5px solid ${tk.iron20}`, background: tk.paper,
                }}>
                  {platos.map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '8px 14px', fontSize: 11.5,
                      borderBottom: i < platos.length - 1 ? `1px solid ${tk.iron20}` : 'none',
                    }}>
                      <span style={{ color: tk.iron }}>{p.nombre}</span>
                      <span style={{ color: tk.iron60, fontVariantNumeric: 'tabular-nums' as const }}>{p.precio_venta ? fmt(p.precio_venta) : '—'}</span>
                    </div>
                  ))}
                </div>
              )}

              <div
                onClick={() => facturaInputRef.current?.click()}
                style={{
                  border: `1.5px dashed ${tk.iron40}`,
                  padding: '32px 16px', textAlign: 'center', cursor: 'pointer',
                  background: tk.cream,
                }}
              >
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><IconInvoice /></div>
                <p style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 13, color: tk.iron, margin: '0 0 4px' }}>
                  Sube facturas o albaranes
                </p>
                <p style={{ fontSize: 10.5, color: tk.iron60, margin: 0, letterSpacing: '0.05em' }}>
                  MÍNIMO 3–5 FACTURAS REPRESENTATIVAS
                </p>
                <input ref={facturaInputRef} type="file" accept="image/*" multiple onChange={handleFacturaFiles} style={{ display: 'none' }} />
              </div>

              {facturaImages.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {facturaImages.map((img, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={img} alt="" style={{ height: 64, border: `1.5px solid ${tk.iron20}`, display: 'block' }} />
                      <button
                        onClick={() => setFacturaImages(prev => prev.filter((_, j) => j !== i))}
                        style={{
                          position: 'absolute', top: -8, right: -8, width: 18, height: 18,
                          background: tk.iron, color: tk.cream, border: 'none', cursor: 'pointer',
                          fontSize: 11, lineHeight: 1,
                        }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
                <button onClick={() => setPaso(1)} style={btnSecondary()}>← ATRÁS</button>
                <button onClick={procesarFacturas} disabled={facturaImages.length === 0 || loading} style={btnPrimary(facturaImages.length === 0 || loading)}>
                  {loading ? 'ANALIZANDO FACTURAS…' : 'EXTRAER INGREDIENTES →'}
                </button>
              </div>
            </div>
          )}

          {/* ────────── PASO 3 — RESUMEN PREVIO ────────── */}
          {paso === 3 && (
            <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, padding: 32 }}>
              <h2 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 22, margin: '0 0 4px', color: tk.iron }}>
                Resumen previo al cruce
              </h2>
              <p style={{ fontSize: 11.5, color: tk.iron60, margin: '0 0 24px' }}>
                La IA va a deducir qué ingredientes lleva cada plato y proponerte el escandallo.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: `1.5px solid ${tk.iron}`, marginBottom: 28 }}>
                {[
                  { l: 'PLATOS DETECTADOS', n: platos.length, d: 'de la carta' },
                  { l: 'INGREDIENTES ÚNICOS', n: ingredientes.length, d: `de ${facturaImages.length} facturas` },
                  { l: 'PROVEEDORES NUEVOS', n: proveedores.length, d: 'con NIF y contacto' },
                ].map((m, i) => (
                  <div key={i} style={{
                    padding: '18px 22px',
                    borderRight: i < 2 ? `1.5px solid ${tk.iron20}` : 'none',
                  }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.15em', color: tk.iron40, textTransform: 'uppercase' as const }}>{m.l}</div>
                    <div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 40, lineHeight: 1, color: tk.iron, margin: '6px 0 2px', fontVariantNumeric: 'tabular-nums' as const }}>{m.n}</div>
                    <div style={{ fontSize: 11, color: tk.iron60 }}>{m.d}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setPaso(2)} style={btnSecondary()}>← ATRÁS</button>
                <button onClick={ejecutarMatch} disabled={loading} style={btnPrimary(loading)}>
                  {loading ? 'CRUZANDO PLATOS CON INGREDIENTES…' : 'CRUZAR CON IA →'}
                </button>
              </div>
            </div>
          )}

          {/* ────────── PASO 4 — VALIDAR ────────── */}
          {paso === 4 && (
            <div>
              <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, padding: '18px 22px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 18, margin: '0 0 2px', color: tk.iron }}>
                    Escandallo propuesto · {recetas.length} recetas
                  </h2>
                  <p style={{ fontSize: 10.5, color: tk.iron60, margin: 0, letterSpacing: '0.02em' }}>
                    Marca/desmarca lo que no sea correcto. Ajusta cantidades. FC% recalcula en vivo.
                  </p>
                </div>
                <span style={{
                  fontFamily: ff.mono, fontSize: 11, color: tk.iron,
                  background: tk.creamSoft, padding: '6px 12px',
                  border: `1px solid ${tk.iron20}`, fontVariantNumeric: 'tabular-nums' as const,
                }}>
                  {recetas.filter(r => r.incluida).length} / {recetas.length} ACTIVAS
                </span>
              </div>

              {recetas.map((r, rIdx) => {
                const fc = r.food_cost_pct
                const fcVariant = fc == null ? 'iron' : fc > 35 ? 'terra' : fc > 28 ? 'clay' : 'apple'
                const fcColor = fcVariant === 'terra' ? tk.terra : fcVariant === 'clay' ? tk.clay : fcVariant === 'apple' ? tk.apple : tk.iron20
                return (
                  <div key={rIdx} style={{
                    background: tk.paper, border: `1.5px solid ${r.incluida ? tk.iron : tk.iron20}`,
                    marginBottom: 8, opacity: r.incluida ? 1 : 0.55,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: tk.iron, color: tk.cream }}>
                      <input type="checkbox" checked={r.incluida} onChange={() => toggleReceta(rIdx)}
                             style={{ width: 14, height: 14, accentColor: tk.apple, cursor: 'pointer', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 13.5, margin: 0, color: tk.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{r.plato}</p>
                        <p style={{ fontFamily: ff.mono, fontSize: 10, margin: 0, opacity: 0.6, marginTop: 1 }}>
                          coste {fmt(r.coste_total)}{r.precio_venta ? ` · PVP ${fmt(r.precio_venta)}` : ''}
                        </p>
                      </div>
                      {fc != null && (
                        <span style={{
                          fontFamily: ff.mono, fontSize: 10.5, fontWeight: 600,
                          padding: '3px 9px', background: fcColor, color: fcVariant === 'apple' ? tk.iron : tk.cream,
                          letterSpacing: '0.04em', flexShrink: 0,
                        }}>FC {fc}%</span>
                      )}
                    </div>
                    {r.incluida && r.lineas.length > 0 && (
                      <div style={{ padding: '4px 18px 12px' }}>
                        {r.lineas.map((l, lIdx) => {
                          const conf = CONF_BADGE[l.confianza]
                          return (
                            <div key={lIdx} style={{
                              display: 'grid', gridTemplateColumns: '14px 1fr 60px 32px 70px 70px',
                              gap: 10, alignItems: 'center',
                              padding: '7px 0',
                              borderBottom: lIdx < r.lineas.length - 1 ? `1px solid ${tk.iron20}` : 'none',
                              fontSize: 11.5,
                            }}>
                              <input type="checkbox" checked={l.incluida} onChange={() => toggleLinea(rIdx, lIdx)}
                                     style={{ width: 12, height: 12, accentColor: tk.iron, cursor: 'pointer' }} />
                              <span style={{ color: tk.iron, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{l.ingrediente}</span>
                              <input type="number" value={l.cantidad}
                                     onChange={e => updateLineaCantidad(rIdx, lIdx, parseFloat(e.target.value) || 0)}
                                     step="0.01"
                                     style={{
                                       padding: '3px 6px', fontFamily: ff.mono, fontSize: 10.5,
                                       border: `1px solid ${tk.iron20}`, textAlign: 'right' as const,
                                       background: tk.paper, color: tk.iron, fontVariantNumeric: 'tabular-nums' as const,
                                     }} />
                              <span style={{ color: tk.iron40, fontSize: 10 }}>{l.unidad}</span>
                              <span style={{ color: tk.iron, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const }}>{fmt(l.coste)}</span>
                              <span style={{ textAlign: 'right' as const }}>
                                <span style={{
                                  fontFamily: ff.mono, fontSize: 9, letterSpacing: '0.12em',
                                  textTransform: 'uppercase' as const,
                                  padding: '2px 7px',
                                  border: `1px solid ${conf.border}`, background: conf.bg, color: conf.color,
                                }}>{conf.label}</span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button onClick={() => setPaso(3)} style={btnSecondary()}>← ATRÁS</button>
                <button onClick={commit} disabled={loading} style={btnPrimary(loading)}>
                  {loading ? 'GUARDANDO…' : 'CONFIRMAR Y GUARDAR →'}
                </button>
              </div>
            </div>
          )}

          {/* ────────── PASO 5 — LISTO ────────── */}
          {paso === 5 && resumen && (
            <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, padding: 40, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><IconCheck /></div>
              <h2 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 28, color: tk.iron, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                Tu cocina está lista.
              </h2>
              <p style={{ fontSize: 12.5, color: tk.iron60, margin: '0 0 32px' }}>
                Hemos creado todo lo que necesitas para empezar.
              </p>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0,
                border: `1.5px solid ${tk.iron}`,
                maxWidth: 480, margin: '0 auto 32px',
              }}>
                {[
                  { l: 'RECETAS CON ESCANDALLO', n: resumen.recetas_creadas },
                  { l: 'INGREDIENTES CON COSTE', n: resumen.ingredientes.creados + resumen.ingredientes.actualizados },
                  { l: 'PROVEEDORES NUEVOS', n: resumen.proveedores.creados },
                  { l: 'LÍNEAS DE ESCANDALLO', n: resumen.lineas_escandallo },
                ].map((m, i) => (
                  <div key={i} style={{
                    padding: '18px 22px',
                    borderRight: i % 2 === 0 ? `1.5px solid ${tk.iron20}` : 'none',
                    borderBottom: i < 2 ? `1.5px solid ${tk.iron20}` : 'none',
                  }}>
                    <div style={{ fontSize: 9.5, letterSpacing: '0.15em', color: tk.iron40, textTransform: 'uppercase' as const }}>{m.l}</div>
                    <div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 36, lineHeight: 1, color: tk.iron, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' as const }}>{m.n}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => router.push('/dashboard/sangrado')} style={btnSecondary()}>VER ESCANDALLO</button>
                <button onClick={() => router.push('/dashboard')} style={btnPrimary(false)}>IR A LA COCINA →</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ───────────────── Button styles
function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    padding: '12px 22px',
    background: disabled ? tk.iron20 : tk.apple,
    border: `1.5px solid ${tk.iron}`,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: ff.mono, fontSize: 11.5, fontWeight: 600,
    color: tk.iron, letterSpacing: '0.08em',
  }
}

function btnSecondary(): React.CSSProperties {
  return {
    padding: '12px 22px',
    background: tk.paper,
    border: `1.5px solid ${tk.iron}`,
    cursor: 'pointer',
    fontFamily: ff.mono, fontSize: 11.5, fontWeight: 600,
    color: tk.iron, letterSpacing: '0.08em',
  }
}
