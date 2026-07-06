'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { tk, ff } from '@/lib/design'

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 4 }).format(v)

function docHref(l: { doc_tipo: string | null; doc_id: number | null; albaran_id: number | null }) {
  if (l.doc_tipo && l.doc_id) return `/dashboard/compras/documentos/${l.doc_tipo}/${l.doc_id}`
  if (l.albaran_id) return `/dashboard/compras/documentos/albaran/${l.albaran_id}`
  return null
}

export default function FichaIngredientePage() {
  const params = useParams() as { id: string }
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/ingredientes/${params.id}/ficha`)
      .then(r => r.json())
      .then(d => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError('No se pudo cargar la ficha'))
  }, [params.id])

  if (error) return <div style={{ padding: 40, fontFamily: ff.mono, fontSize: 13, color: tk.terra }}>{error}</div>
  if (!data) return <div style={{ padding: 40, fontFamily: ff.mono, fontSize: 13, color: tk.iron60 }}>Cargando…</div>

  const { ingrediente: ing, compras, precios, recetas, mermas, alertas } = data

  return (
    <div style={{ padding: '32px 36px 60px' }}>
      <Link href="/dashboard/ingredientes" style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, textDecoration: 'none' }}>← Ingredientes</Link>

      {/* Cabecera de la ficha */}
      <div style={{ margin: '12px 0 18px' }}>
        <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.2em', color: tk.appleDeep, textTransform: 'uppercase', margin: '0 0 8px' }}>
          FICHA DE INGREDIENTE · TRAZABILIDAD
        </p>
        <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em', margin: '0 0 4px', color: tk.iron }}>{ing.descr || `#${ing.id}`}</h1>
        <p style={{ fontFamily: ff.mono, fontSize: 12.5, color: tk.iron60, margin: 0 }}>
          {[ing.type, ing.codi].filter(Boolean).join(' · ') || 'Sin categoría'}
        </p>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {alertas.map((a: any, i: number) => (
            <div key={i} style={{
              padding: '8px 14px', fontFamily: ff.mono, fontSize: 11.5,
              background: a.tipo === 'danger' ? tk.terraSoft : a.tipo === 'warning' ? tk.claySoft : tk.creamSoft,
              border: `1.5px solid ${a.tipo === 'danger' ? tk.terra : a.tipo === 'warning' ? tk.clay : tk.iron20}`,
              color: a.tipo === 'danger' ? tk.terra : a.tipo === 'warning' ? tk.clay : tk.iron60,
            }}>{a.texto}</div>
          ))}
        </div>
      )}

      {/* Resumen operativo */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 16 }}>
        <div style={panelHead}>Estado actual</div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          <Info label="Coste actual" value={ing.cost != null ? `${fmt(ing.cost)}/${ing.unit || 'ud'}` : 'Sin coste'} />
          <Info label="Unidad base" value={ing.unit || '—'} />
          <Info label="IVA" value={ing.iva != null ? `${ing.iva}%` : '—'} />
          <Info label="Proveedor" value={ing.proveedor_descr || ing.proveedor_nombre || 'Sin asignar'} link={ing.proveedor_id ? `/dashboard/proveedores/${ing.proveedor_id}` : undefined} />
          <Info label="Almacén" value={ing.almacen_principal || 'Sin asignar'} />
          <Info label="Última compra" value={compras[0]?.fecha || '—'} />
        </div>
      </div>

      {/* Últimas compras */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 16 }}>
        <div style={panelHead}>Últimas compras · {compras.length}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr>
              {['Fecha', 'Proveedor', 'Cant.', 'Ud.', '€/ud', 'Total', 'Cambio', 'Documento'].map((h, i) => (
                <th key={h} style={{ ...th, textAlign: [2, 4, 5, 6].includes(i) ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {compras.map((l: any) => {
                const href = docHref(l)
                return (
                  <tr key={l.id} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                    <td style={td}>{l.fecha || '—'}</td>
                    <td style={td}>{l.vendor || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.cantidad ?? '—'}</td>
                    <td style={td}>{l.unidad || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmt(l.precio_unitario)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmt(l.total_linea)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: l.cambio_pct == null ? tk.iron40 : l.cambio_pct > 0 ? tk.terra : tk.appleDeep }}>
                      {l.cambio_pct == null ? '—' : `${l.cambio_pct > 0 ? '+' : ''}${l.cambio_pct}%`}
                    </td>
                    <td style={td}>
                      {href
                        ? <Link href={href} style={{ color: tk.appleDeep, textDecoration: 'none', fontWeight: 600 }}>ver documento →</Link>
                        : <span style={{ color: tk.iron40 }}>—</span>}
                    </td>
                  </tr>
                )
              })}
              {compras.length === 0 && <tr><td colSpan={8} style={emptyTd}>Sin compras registradas. Sube un albarán o factura desde Escaneo.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de precios */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 16 }}>
        <div style={panelHead}>Historial de precios · {precios.length}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr>
              {['Fecha', 'Proveedor', 'Anterior', 'Nuevo', 'Variación', 'Fuente', 'Documento'].map((h, i) => (
                <th key={h} style={{ ...th, textAlign: [2, 3, 4].includes(i) ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {precios.map((p: any) => {
                const delta = p.precio_anterior != null && p.precio_anterior > 0
                  ? Math.round(((p.precio - p.precio_anterior) / p.precio_anterior) * 1000) / 10
                  : null
                return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                    <td style={td}>{p.fecha || '—'}</td>
                    <td style={td}>{p.vendor || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{p.precio_anterior != null ? fmt(p.precio_anterior) : '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmt(p.precio)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: delta == null ? tk.iron40 : delta > 0 ? tk.terra : tk.appleDeep }}>
                      {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}
                    </td>
                    <td style={td}>{p.fuente || '—'}</td>
                    <td style={td}>
                      {p.doc_tipo && p.doc_id
                        ? <Link href={`/dashboard/compras/documentos/${p.doc_tipo}/${p.doc_id}`} style={{ color: tk.appleDeep, textDecoration: 'none', fontWeight: 600 }}>ver documento →</Link>
                        : <span style={{ color: tk.iron40 }}>—</span>}
                    </td>
                  </tr>
                )
              })}
              {precios.length === 0 && <tr><td colSpan={7} style={emptyTd}>Sin historial de precios todavía.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recetas donde se usa */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 16 }}>
        <div style={panelHead}>Se usa en · {recetas.length} escandallo(s)</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr>
              {['Receta', 'Tipo', 'Cantidad', 'Coste que aporta', 'PVP receta'].map((h, i) => (
                <th key={h} style={{ ...th, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {recetas.map((r: any, i: number) => (
                <tr key={`${r.id}-${i}`} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                  <td style={td}><Link href="/dashboard/sangrado" style={{ color: tk.appleDeep, textDecoration: 'none', fontWeight: 600 }}>{r.nombre}</Link></td>
                  <td style={td}>{r.es_subreceta ? 'elaboración intermedia' : 'plato final'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.cantidad != null ? `${r.cantidad} ${r.unidad || ''}` : '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmt(r.coste_linea)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmt(r.precio_venta)}</td>
                </tr>
              ))}
              {recetas.length === 0 && <tr><td colSpan={5} style={emptyTd}>Ningún escandallo usa este ingrediente.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mermas */}
      {mermas.length > 0 && (
        <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}` }}>
          <div style={panelHead}>Mermas registradas · {mermas.length}</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead><tr>
                {['Fecha', 'Cantidad', 'Motivo', 'Coste estimado'].map((h, i) => (
                  <th key={h} style={{ ...th, textAlign: i === 1 || i === 3 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {mermas.map((m: any) => (
                  <tr key={m.id} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                    <td style={td}>{m.fecha || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{m.cantidad != null ? `${m.cantidad} ${m.unidad || ''}` : '—'}</td>
                    <td style={td}>{m.motivo || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', color: tk.terra, fontWeight: 600 }}>{fmt(m.coste_estimado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Info({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div>
      <div style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      {link
        ? <Link href={link} style={{ fontFamily: ff.mono, fontSize: 13, color: tk.appleDeep, textDecoration: 'none', fontWeight: 600 }}>{value}</Link>
        : <div style={{ fontFamily: ff.mono, fontSize: 13, color: tk.iron }}>{value}</div>}
    </div>
  )
}

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontFamily: ff.mono, fontSize: 11 }
const panelHead: React.CSSProperties = { padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.iron, textTransform: 'uppercase' }
const th: React.CSSProperties = { padding: '8px 12px', fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.1em', color: tk.iron40, textTransform: 'uppercase', fontWeight: 400, background: tk.creamSoft, borderBottom: `1px solid ${tk.iron20}` }
const td: React.CSSProperties = { padding: '7px 12px', color: tk.iron, fontVariantNumeric: 'tabular-nums', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const emptyTd: React.CSSProperties = { padding: 22, textAlign: 'center', color: tk.iron40, fontFamily: ff.mono, fontSize: 11 }
