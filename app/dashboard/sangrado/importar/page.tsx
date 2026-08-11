'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { tk, ff } from '@/lib/design'

interface Ing { id: number; descr: string; unit: string | null; cost: number | null }

const eur = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 4 }).format(v)

export default function ImportarRecetasPage() {
  const [ingredientes, setIngredientes] = useState<Ing[]>([])
  const [archivo, setArchivo] = useState<string>('')
  const [analizando, setAnalizando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [recetas, setRecetas] = useState<any[]>([])
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/data/ingredientes?limit=5000').then(r => r.json()).then(d => setIngredientes(d.data || [])).catch(() => {})
  }, [])

  function loadXLSX(): Promise<any> {
    return new Promise((resolve, reject) => {
      if ((window as any).XLSX) return resolve((window as any).XLSX)
      const s = document.createElement('script')
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
      s.onload = () => (window as any).XLSX ? resolve((window as any).XLSX) : reject(new Error('No se pudo cargar el lector de Excel'))
      s.onerror = () => reject(new Error('No se pudo cargar el lector de Excel'))
      document.head.appendChild(s)
    })
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setError(''); setResultado(null); setRecetas([]); setAnalizando(true); setArchivo(f.name)
    try {
      const XLSX = await loadXLSX()
      const buf = new Uint8Array(await f.arrayBuffer())
      const wb = XLSX.read(buf, { type: 'array' })
      // Cada hoja = una receta. Se envían las celdas en crudo; la detección
      // del formato se hace en el servidor.
      const hojas = wb.SheetNames.map((nombre: string) => ({
        nombre,
        filas: XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: true, defval: '', blankrows: true }),
      }))
      const res = await fetch('/api/recetas/importar/parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hojas }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'No se pudo leer el archivo'); setAnalizando(false); return }
      setRecetas(d.recetas || [])
    } catch (err: any) {
      setError(err?.message || 'No se pudo leer el archivo')
    }
    setAnalizando(false)
  }

  function editReceta(ri: number, campo: string, valor: any) {
    setRecetas(rs => rs.map((r, i) => i === ri ? { ...r, [campo]: valor } : r))
  }

  function editLinea(ri: number, li: number, cambios: any) {
    setRecetas(rs => rs.map((r, i) => i !== ri ? r : {
      ...r,
      lineas: r.lineas.map((l: any, j: number) => j === li ? { ...l, ...cambios } : l),
    }))
  }

  function cambiarDestino(ri: number, li: number, valor: string) {
    if (valor === '__crear__') return editLinea(ri, li, { accion: 'crear', ingrediente_id: null, coste_efectivo: recetas[ri].lineas[li].precio ?? null })
    if (valor === '__omitir__') return editLinea(ri, li, { accion: 'omitir' })
    const ing = ingredientes.find(i => String(i.id) === valor)
    editLinea(ri, li, {
      accion: 'enlazar', ingrediente_id: ing?.id ?? null, ingrediente_nombre: ing?.descr ?? null,
      coste_efectivo: recetas[ri].lineas[li].precio ?? ing?.cost ?? null, match: 'manual',
    })
  }

  async function guardar() {
    setGuardando(true); setError('')
    const res = await fetch('/api/recetas/importar/commit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recetas }),
    })
    const d = await res.json()
    if (!res.ok) { setError(d.error || 'No se pudo guardar'); setGuardando(false); return }
    setResultado(d.resultado); setRecetas([]); setGuardando(false)
  }

  const totalLineas = recetas.reduce((s, r) => s + r.lineas.filter((l: any) => l.accion !== 'omitir').length, 0)

  return (
    <div style={{ padding: '32px 36px 60px' }}>
      <Link href="/dashboard/sangrado" style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, textDecoration: 'none' }}>← Escandallos</Link>

      <div style={{ margin: '12px 0 22px' }}>
        <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.2em', color: tk.appleDeep, textTransform: 'uppercase', margin: '0 0 8px' }}>
          ESCANDALLOS · IMPORTAR RECETARIO
        </p>
        <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em', margin: '0 0 6px', color: tk.iron }}>
          Sube tu recetario en Excel
        </h1>
        <p style={{ fontFamily: ff.mono, fontSize: 12.5, color: tk.iron60, margin: 0, maxWidth: 760 }}>
          Cada hoja del archivo se lee como una receta: ingredientes, cantidades, merma, rendimiento y procedimiento.
          Antes de guardar podrás revisarlo todo y completar los precios que falten.
        </p>
      </div>

      {/* Subida */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, padding: 18, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => fileRef.current?.click()} style={btnGhost}>{archivo ? 'Cambiar archivo' : 'Seleccionar Excel'}</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onFile} />
        {archivo && <span style={{ fontFamily: ff.mono, fontSize: 12, color: tk.iron }}>{archivo}</span>}
        {analizando && <span style={{ fontFamily: ff.mono, fontSize: 12, color: tk.appleDeep }}>Analizando…</span>}
      </div>

      {error && (
        <div style={{ background: tk.terraSoft, border: `1.5px solid ${tk.terra}`, padding: '12px 16px', marginBottom: 16, fontFamily: ff.mono, fontSize: 12, color: tk.terra }}>{error}</div>
      )}

      {resultado && (
        <div style={{ background: tk.appleSoft, border: `1.5px solid ${tk.appleDeep}`, padding: '14px 18px', marginBottom: 16, fontFamily: ff.mono, fontSize: 12.5, color: tk.iron }}>
          <strong>✓ Importación completada.</strong> {resultado.recetas_creadas} receta(s) · {resultado.lineas} líneas · {resultado.ingredientes_creados} ingrediente(s) nuevos en el catálogo.
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/dashboard/sangrado" style={{ ...btnPrimary, textDecoration: 'none' }}>VER ESCANDALLOS →</Link>
            {resultado.ingredientes_creados > 0 && (
              <Link href="/dashboard/ingredientes?filtro=sin_coste" style={{ ...btnGhost, textDecoration: 'none' }}>COMPLETAR INGREDIENTES NUEVOS →</Link>
            )}
          </div>
        </div>
      )}

      {recetas.map((r, ri) => (
        <div key={ri} style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 18 }}>
          <div style={panelHead}>Hoja «{r.hoja}» · revisión antes de guardar</div>

          {/* Cabecera editable */}
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, borderBottom: `1px solid ${tk.iron20}` }}>
            <Campo label="Nombre de la receta" ancho>
              <input value={r.nombre || ''} onChange={e => editReceta(ri, 'nombre', e.target.value)} style={input} />
            </Campo>
            <Campo label="Código"><input value={r.codigo || ''} onChange={e => editReceta(ri, 'codigo', e.target.value)} style={input} /></Campo>
            <Campo label="Familia"><input value={r.familia || ''} onChange={e => editReceta(ri, 'familia', e.target.value)} style={input} /></Campo>
            <Campo label="Porciones"><input type="number" value={r.raciones ?? ''} onChange={e => editReceta(ri, 'raciones', e.target.value === '' ? null : Number(e.target.value))} style={input} /></Campo>
            <Campo label="PVP por porción (€)"><input type="number" step="0.01" value={r.precio_venta ?? ''} onChange={e => editReceta(ri, 'precio_venta', e.target.value === '' ? null : Number(e.target.value))} style={input} /></Campo>
            <Campo label="Rendimiento neto"><input type="number" value={r.rendimiento_neto ?? ''} onChange={e => editReceta(ri, 'rendimiento_neto', e.target.value === '' ? null : Number(e.target.value))} style={input} /></Campo>
          </div>

          {/* Avisos */}
          {r.avisos?.length > 0 && (
            <div style={{ background: tk.claySoft, borderBottom: `1px solid ${tk.iron20}`, padding: '10px 16px', fontFamily: ff.mono, fontSize: 11, color: tk.clay }}>
              {r.avisos.map((a: string, i: number) => <div key={i}>· {a}</div>)}
            </div>
          )}

          {/* Resumen del cruce */}
          <div style={{ padding: '10px 16px', display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: ff.mono, fontSize: 11, color: tk.iron60, borderBottom: `1px solid ${tk.iron20}` }}>
            <span>{r.resumen.total_lineas} ingredientes</span>
            <span style={{ color: tk.appleDeep }}>{r.resumen.a_enlazar} ya en el catálogo</span>
            <span style={{ color: tk.clay }}>{r.resumen.a_crear} se crearán</span>
            {r.resumen.aproximados > 0 && <span style={{ color: tk.clay }}>{r.resumen.aproximados} por coincidencia aproximada — revísalos</span>}
            {r.resumen.unidades_incompatibles > 0 && <span style={{ color: tk.terra }}>{r.resumen.unidades_incompatibles} con unidades incompatibles</span>}
            {r.procedimiento?.length > 0 && <span>{r.procedimiento.length} pasos de elaboración</span>}
          </div>

          {/* Líneas */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: ff.mono, fontSize: 11 }}>
              <thead><tr>
                {['Ingrediente (Excel)', 'Cant.', 'Ud.', 'Merma', 'Destino en el catálogo', '€/ud', 'Coste línea'].map((h, i) => (
                  <th key={h} style={{ ...th, textAlign: [1, 3, 5, 6].includes(i) ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {r.lineas.map((l: any, li: number) => {
                  const omitida = l.accion === 'omitir'
                  const costeLinea = l.cantidad_bruta != null && l.coste_efectivo != null
                    ? l.cantidad_bruta * l.coste_efectivo * factorUnidad(l.unidad, l.ingrediente_unidad || l.unidad)
                    : null
                  return (
                    <tr key={li} style={{ borderTop: `1px solid ${tk.iron20}`, opacity: omitida ? 0.4 : 1, background: l.match === 'aproximado' ? tk.claySoft : 'transparent' }}>
                      <td style={td}>{l.nombre}{l.nota ? <div style={{ color: tk.iron40, fontSize: 10 }}>{l.nota}</div> : null}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{l.cantidad_bruta ?? '—'}</td>
                      <td style={td}>{l.unidad || '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{l.merma_pct != null ? `${l.merma_pct}%` : '—'}</td>
                      <td style={{ ...td, whiteSpace: 'normal', minWidth: 240 }}>
                        <select
                          value={l.accion === 'crear' ? '__crear__' : l.accion === 'omitir' ? '__omitir__' : String(l.ingrediente_id ?? '')}
                          onChange={e => cambiarDestino(ri, li, e.target.value)}
                          style={{ ...sel, borderColor: l.match === 'aproximado' ? tk.clay : tk.iron20 }}
                        >
                          <option value="__crear__">+ Crear «{l.nombre}» como ingrediente nuevo</option>
                          <option value="__omitir__">— No importar esta línea</option>
                          {ingredientes.map(i => <option key={i.id} value={i.id}>{i.descr}</option>)}
                        </select>
                        {l.match === 'aproximado' && !omitida && (
                          <div style={{ color: tk.clay, fontSize: 10, marginTop: 3 }}>Coincidencia aproximada: confirma que es el ingrediente correcto</div>
                        )}
                        {l.sugerencia && !omitida && (
                          <div style={{ color: tk.terra, fontSize: 10, marginTop: 3 }}>⚠ {l.sugerencia}</div>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <input
                          type="number" step="0.0001" placeholder="—"
                          value={l.coste_efectivo ?? ''}
                          onChange={e => editLinea(ri, li, { coste_efectivo: e.target.value === '' ? null : Number(e.target.value) })}
                          style={{ ...input, width: 84, textAlign: 'right', padding: '4px 6px' }}
                        />
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{costeLinea != null ? eur(costeLinea) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {recetas.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <p style={{ fontFamily: ff.mono, fontSize: 11.5, color: tk.iron60, margin: 0 }}>
            Se guardarán {recetas.length} receta(s) con {totalLineas} líneas. Los ingredientes nuevos entran al catálogo y podrás completarlos después.
          </p>
          <button onClick={guardar} disabled={guardando} style={btnPrimary}>
            {guardando ? 'GUARDANDO…' : 'CONFIRMAR E IMPORTAR →'}
          </button>
        </div>
      )}
    </div>
  )
}

// Conversión g↔kg / ml↔l para estimar el coste de línea en la previsualización
function factorUnidad(linea: string | null, ing: string | null): number {
  const n = (u: string | null) => (u || '').toLowerCase().trim()
  const a = n(linea), b = n(ing)
  if (!a || !b || a === b) return 1
  if (a === 'g' && b === 'kg') return 0.001
  if (a === 'ml' && b === 'l') return 0.001
  if (a === 'cl' && b === 'l') return 0.01
  if (a === 'kg' && b === 'g') return 1000
  if (a === 'l' && b === 'ml') return 1000
  return 1
}

function Campo({ label, children, ancho }: { label: string; children: React.ReactNode; ancho?: boolean }) {
  return (
    <div style={ancho ? { gridColumn: 'span 2', minWidth: 0 } : undefined}>
      <div style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

const panelHead: React.CSSProperties = { padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.iron, textTransform: 'uppercase' }
const th: React.CSSProperties = { padding: '8px 12px', fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.1em', color: tk.iron40, textTransform: 'uppercase', fontWeight: 400, background: tk.creamSoft, borderBottom: `1px solid ${tk.iron20}` }
const td: React.CSSProperties = { padding: '7px 12px', color: tk.iron, fontVariantNumeric: 'tabular-nums', verticalAlign: 'top' }
const sel: React.CSSProperties = { width: '100%', padding: '5px 8px', border: `1.5px solid ${tk.iron20}`, background: tk.cream, color: tk.iron, fontFamily: ff.mono, fontSize: 11, outline: 'none' }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 9px', border: `1.5px solid ${tk.iron20}`, background: tk.cream, color: tk.iron, fontFamily: ff.mono, fontSize: 12, outline: 'none' }
const btnPrimary: React.CSSProperties = { padding: '9px 18px', background: tk.apple, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: tk.iron, letterSpacing: '0.06em', cursor: 'pointer' }
const btnGhost: React.CSSProperties = { padding: '9px 16px', background: tk.paper, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: tk.iron, letterSpacing: '0.06em', cursor: 'pointer' }
