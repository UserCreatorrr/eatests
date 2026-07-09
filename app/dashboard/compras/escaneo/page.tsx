'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { tk, ff } from '@/lib/design'

interface Ing { id: number; descr: string; unit: string | null; cost: number | null }
interface Linea {
  nombre: string; cantidad: number | null; unidad: string | null; precio_unitario: number | null; total_linea: number | null
  ingrediente_id: number | null; ingrediente_nombre: string | null; ingrediente_unidad: string | null
  coste_actual: number | null; cambio_pct: number | null; mapeado: boolean; excluida?: boolean
  crear_ingrediente?: boolean
}

const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)

export default function EscaneoPage() {
  const [tipo, setTipo] = useState<'albaran' | 'factura'>('albaran')
  const [image, setImage] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<any>(null)
  const [lineas, setLineas] = useState<Linea[]>([])
  const [ingredientes, setIngredientes] = useState<Ing[]>([])
  const [actualizarPrecios, setActualizarPrecios] = useState(true)
  const [crearProveedor, setCrearProveedor] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetch('/api/data/ingredientes?limit=500').then(r => r.json()).then(d => setIngredientes(d.data || [])).catch(() => {}) }, [])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const reader = new FileReader()
    reader.onload = () => { setImage(reader.result as string); setData(null); setResultado(null) }
    reader.readAsDataURL(f); e.target.value = ''
  }

  async function parse() {
    if (!image) return
    setParsing(true); setResultado(null)
    const res = await fetch('/api/compras/escaneo/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, tipo }) })
    const d = await res.json()
    setData(d)
    setLineas(d.lineas || [])
    setCrearProveedor(d.warnings?.proveedor_nuevo || false)
    setParsing(false)
  }

  function remap(idx: number, ingId: string) {
    if (ingId === '__crear__') {
      setLineas(ls => ls.map((l, i) => i !== idx ? l : {
        ...l, ingrediente_id: null, ingrediente_nombre: l.nombre, ingrediente_unidad: l.unidad,
        coste_actual: null, cambio_pct: null, mapeado: true, crear_ingrediente: true,
      }))
      return
    }
    const ing = ingredientes.find(i => String(i.id) === ingId)
    setLineas(ls => ls.map((l, i) => i !== idx ? l : {
      ...l, ingrediente_id: ing?.id ?? null, ingrediente_nombre: ing?.descr ?? null, ingrediente_unidad: ing?.unit ?? null,
      coste_actual: ing?.cost ?? null, mapeado: !!ing, crear_ingrediente: false,
    }))
  }
  function toggleExcl(idx: number) { setLineas(ls => ls.map((l, i) => i === idx ? { ...l, excluida: !l.excluida } : l)) }

  async function guardar() {
    setSaving(true)
    const res = await fetch('/api/compras/escaneo/commit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, cabecera: data.cabecera, lineas, actualizar_precios: actualizarPrecios, crear_proveedor: crearProveedor, image }),
    })
    const d = await res.json()
    setResultado(d); setSaving(false)
  }

  const c = data?.cabecera

  return (
    <div style={{ padding: '32px 36px 60px' }}>
      <Link href="/dashboard/compras" style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, textDecoration: 'none' }}>← Compras</Link>
      <div style={{ margin: '12px 0 22px' }}>
        <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.2em', color: tk.appleDeep, textTransform: 'uppercase', margin: '0 0 8px' }}>FOOD COST · ESCANEO + VALIDACIÓN</p>
        <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em', margin: '0 0 6px', color: tk.iron }}>Sube un documento y valídalo</h1>
        <p style={{ fontFamily: ff.mono, fontSize: 12.5, color: tk.iron60, margin: 0 }}>Foto → detecta proveedor y líneas → mapea ingredientes → revisa cambios de precio → guarda y actualiza costes.</p>
      </div>

      {/* Upload */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, padding: 18, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', border: `1.5px solid ${tk.iron}` }}>
          {(['albaran', 'factura'] as const).map(t => (
            <button key={t} onClick={() => setTipo(t)} style={{ padding: '7px 14px', background: tipo === t ? tk.iron : tk.paper, color: tipo === t ? tk.cream : tk.iron, border: 'none', cursor: 'pointer', fontFamily: ff.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', borderLeft: t === 'factura' ? `1.5px solid ${tk.iron}` : 'none' }}>{t === 'albaran' ? 'Albarán' : 'Factura'}</button>
          ))}
        </div>
        <button onClick={() => fileRef.current?.click()} style={btnGhost}>{image ? 'Cambiar imagen' : 'Subir foto'}</button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onFile} />
        {image && <img src={image} alt="" style={{ height: 44, border: `1.5px solid ${tk.iron20}` }} />}
        <button onClick={parse} disabled={!image || parsing} style={btnPrimary}>{parsing ? 'ANALIZANDO…' : 'EXTRAER Y VALIDAR →'}</button>
      </div>

      {data && c && (
        <>
          {/* Cabecera detectada */}
          <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 16 }}>
            <div style={panelHead}>Cabecera detectada</div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              <Info label="Proveedor" value={c.vendor || '—'} extra={c.proveedor_match ? `↳ ${c.proveedor_match}` : (c.vendor ? 'nuevo' : null)} extraColor={c.proveedor_match ? tk.appleDeep : tk.clay} />
              <Info label="NIF/CIF" value={c.vendor_nif || '—'} />
              <Info label="Fecha" value={c.fecha || '—'} />
              <Info label="Total" value={c.total != null ? fmt(c.total) : '—'} />
            </div>
          </div>

          {/* Warnings */}
          {(data.warnings.sin_mapear > 0 || data.warnings.con_cambio_precio > 0 || data.warnings.proveedor_nuevo) && (
            <div style={{ background: tk.claySoft, border: `1.5px solid ${tk.clay}`, padding: '10px 14px', marginBottom: 16, fontFamily: ff.mono, fontSize: 11, color: tk.clay }}>
              {[
                data.warnings.proveedor_nuevo && 'proveedor no encontrado en el catálogo',
                data.warnings.sin_mapear > 0 && `${data.warnings.sin_mapear} línea(s) sin ingrediente mapeado`,
                data.warnings.con_cambio_precio > 0 && `${data.warnings.con_cambio_precio} cambio(s) de precio detectados`,
              ].filter(Boolean).join(' · ')}
            </div>
          )}

          {/* Líneas */}
          <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 16 }}>
            <div style={panelHead}>Líneas extraídas · valida el mapeo de ingredientes</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: ff.mono, fontSize: 11 }}>
              <thead><tr>
                {['Producto detectado', 'Cant.', 'Ud.', '€/ud', 'Ingrediente (catálogo)', 'Cambio', ''].map((h, i) => (
                  <th key={h} style={{ ...th, textAlign: i === 1 || i === 3 || i === 5 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {lineas.map((l, idx) => (
                  <tr key={idx} style={{ borderTop: `1px solid ${tk.iron20}`, opacity: l.excluida ? 0.4 : 1, background: !l.mapeado ? tk.claySoft : 'transparent' }}>
                    <td style={td}>{l.nombre || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.cantidad ?? '—'}</td>
                    <td style={td}>{l.unidad || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.precio_unitario != null ? fmt(l.precio_unitario) : '—'}</td>
                    <td style={td}>
                      <select value={l.crear_ingrediente ? '__crear__' : (l.ingrediente_id ?? '')} onChange={e => remap(idx, e.target.value)} style={{ ...sel, borderColor: l.mapeado ? (l.crear_ingrediente ? tk.appleDeep : tk.iron20) : tk.clay }}>
                        <option value="">— sin mapear —</option>
                        <option value="__crear__">+ Crear "{(l.nombre || 'ingrediente').slice(0, 40)}" como ingrediente nuevo</option>
                        {ingredientes.map(i => <option key={i.id} value={i.id}>{i.descr}</option>)}
                      </select>
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: l.cambio_pct == null ? tk.iron40 : l.cambio_pct > 0 ? tk.terra : tk.appleDeep, fontWeight: 600 }}>
                      {l.cambio_pct == null ? '—' : `${l.cambio_pct > 0 ? '+' : ''}${l.cambio_pct}%`}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => toggleExcl(idx)} title={l.excluida ? 'Incluir' : 'Excluir'} style={{ padding: '2px 8px', background: l.excluida ? tk.creamSoft : tk.terraSoft, border: `1px solid ${l.excluida ? tk.iron20 : tk.terra}`, color: l.excluida ? tk.iron60 : tk.terra, cursor: 'pointer', fontFamily: ff.mono, fontSize: 11 }}>{l.excluida ? '+' : '×'}</button>
                    </td>
                  </tr>
                ))}
                {lineas.length === 0 && <tr><td colSpan={7} style={{ padding: 22, textAlign: 'center', color: tk.iron40 }}>No se detectaron líneas.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Opciones + guardar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 18, fontFamily: ff.mono, fontSize: 11.5, color: tk.iron }}>
              <label style={{ display: 'flex', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={actualizarPrecios} onChange={e => setActualizarPrecios(e.target.checked)} /> Actualizar costes + historial de precios</label>
              {data.warnings.proveedor_nuevo && <label style={{ display: 'flex', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={crearProveedor} onChange={e => setCrearProveedor(e.target.checked)} /> Crear proveedor "{c.vendor}"</label>}
            </div>
            <button onClick={guardar} disabled={saving} style={btnPrimary}>{saving ? 'GUARDANDO…' : `GUARDAR ${tipo === 'factura' ? 'FACTURA' : 'ALBARÁN'} →`}</button>
          </div>

          {resultado?.ok && (
            <div style={{ marginTop: 16, background: tk.appleSoft, border: `1.5px solid ${tk.appleDeep}`, padding: '12px 16px', fontFamily: ff.mono, fontSize: 12, color: tk.iron, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <span>
                ✓ Guardado <strong>{resultado.resumen.documento}</strong> · {resultado.resumen.lineas} líneas · {resultado.resumen.precios_actualizados} precios actualizados
                {resultado.resumen.ingredientes_creados > 0 ? ` · ${resultado.resumen.ingredientes_creados} ingrediente(s) nuevo(s) en el catálogo` : ''}
                {resultado.resumen.recetas_afectadas > 0 ? ` · ${resultado.resumen.recetas_afectadas} escandallo(s) afectado(s)` : ''}.
              </span>
              <Link
                href={`/dashboard/compras/documentos/${resultado.resumen.doc_tipo}/${resultado.resumen.doc_id}`}
                style={{ fontFamily: ff.mono, fontSize: 11, fontWeight: 600, padding: '7px 14px', background: tk.apple, border: `1.5px solid ${tk.iron}`, color: tk.iron, textDecoration: 'none', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}
              >
                VER DOCUMENTO →
              </Link>
            </div>
          )}
          {resultado?.error && <div style={{ marginTop: 16, background: tk.terraSoft, border: `1.5px solid ${tk.terra}`, padding: '12px 16px', fontFamily: ff.mono, fontSize: 12, color: tk.terra }}>{resultado.error}</div>}
        </>
      )}
    </div>
  )
}

function Info({ label, value, extra, extraColor }: { label: string; value: string; extra?: string | null; extraColor?: string }) {
  return (
    <div>
      <div style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: ff.mono, fontSize: 13, color: tk.iron, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      {extra && <div style={{ fontFamily: ff.mono, fontSize: 10, color: extraColor || tk.iron40, marginTop: 2 }}>{extra}</div>}
    </div>
  )
}

const panelHead: React.CSSProperties = { padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.iron, textTransform: 'uppercase' }
const th: React.CSSProperties = { padding: '8px 12px', fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.1em', color: tk.iron40, textTransform: 'uppercase', fontWeight: 400, background: tk.creamSoft, borderBottom: `1px solid ${tk.iron20}` }
const td: React.CSSProperties = { padding: '7px 12px', color: tk.iron, fontVariantNumeric: 'tabular-nums', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const sel: React.CSSProperties = { width: '100%', padding: '5px 8px', border: `1.5px solid ${tk.iron20}`, background: tk.cream, color: tk.iron, fontFamily: ff.mono, fontSize: 11, outline: 'none' }
const btnPrimary: React.CSSProperties = { padding: '9px 18px', background: tk.apple, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: tk.iron, letterSpacing: '0.06em', cursor: 'pointer' }
const btnGhost: React.CSSProperties = { padding: '9px 16px', background: tk.paper, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: tk.iron, letterSpacing: '0.06em', cursor: 'pointer' }
