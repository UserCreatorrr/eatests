'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { tk, ff } from '@/lib/design'

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)

export default function DocumentoDetallePage() {
  const params = useParams() as { tipo: string; id: string }
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [imgOpen, setImgOpen] = useState(false)

  useEffect(() => {
    fetch(`/api/compras/documentos/${params.tipo}/${params.id}`)
      .then(r => r.json())
      .then(d => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError('No se pudo cargar el documento'))
  }, [params.tipo, params.id])

  if (error) return <div style={{ padding: 40, fontFamily: ff.mono, fontSize: 13, color: tk.terra }}>{error}</div>
  if (!data) return <div style={{ padding: 40, fontFamily: ff.mono, fontSize: 13, color: tk.iron60 }}>Cargando…</div>

  const { tipo, cabecera: c, lineas, impacto } = data
  const esFactura = tipo === 'factura'
  const backHref = esFactura ? '/dashboard/compras/facturas' : '/dashboard/compras/albaranes'

  return (
    <div style={{ padding: '32px 36px 60px' }}>
      <Link href={backHref} style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, textDecoration: 'none' }}>
        ← {esFactura ? 'Facturas' : 'Albaranes'}
      </Link>
      <div style={{ margin: '12px 0 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.2em', color: tk.appleDeep, textTransform: 'uppercase', margin: '0 0 8px' }}>
            COMPRAS · {esFactura ? 'FACTURA' : 'ALBARÁN'} · TRANSACCIÓN TRAZABLE
          </p>
          <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 30, letterSpacing: '-0.02em', margin: '0 0 6px', color: tk.iron }}>{c.num || `#${c.id}`}</h1>
          <p style={{ fontFamily: ff.mono, fontSize: 12.5, color: tk.iron60, margin: 0 }}>
            {c.vendor || 'Proveedor desconocido'}{c.fecha ? ` · ${c.fecha}` : ''}{c.source === 'scanny' ? ' · escaneado con Scanny' : ''}
          </p>
        </div>
        <span style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.1em', padding: '5px 12px', background: tk.appleSoft, border: `1.5px solid ${tk.appleDeep}`, color: tk.appleDeep, textTransform: 'uppercase' }}>
          {esFactura ? (c.paid ? 'Pagada' : 'Validada · pendiente de pago') : (c.estado || 'Validado')}
        </span>
      </div>

      {/* Cabecera */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 16 }}>
        <div style={panelHead}>Cabecera</div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
          <Info label="Proveedor" value={c.vendor || '—'} />
          <Info label="NIF/CIF" value={c.nif || '—'} />
          <Info label="Fecha" value={c.fecha || '—'} />
          {esFactura && <Info label="Vencimiento" value={c.fecha_vencimiento || '—'} />}
          <Info label="Base" value={fmt(c.base)} />
          <Info label="IVA" value={fmt(c.taxes)} />
          <Info label="Total" value={fmt(c.total)} />
        </div>
      </div>

      {/* Documento original */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 16 }}>
        <div style={{ ...panelHead, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Documento original</span>
          {c.doc_image && (
            <button onClick={() => setImgOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: ff.mono, fontSize: 10, color: tk.appleDeep, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {imgOpen ? 'Contraer' : 'Ampliar'}
            </button>
          )}
        </div>
        <div style={{ padding: 16 }}>
          {c.doc_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.doc_image}
              alt={`Documento ${c.num}`}
              onClick={() => setImgOpen(o => !o)}
              style={{ maxWidth: '100%', maxHeight: imgOpen ? 'none' : 320, border: `1.5px solid ${tk.iron20}`, cursor: 'zoom-in', display: 'block' }}
            />
          ) : (
            <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.iron40, margin: 0 }}>
              Este documento se registró sin imagen (entrada manual o anterior a la trazabilidad de documentos).
            </p>
          )}
        </div>
      </div>

      {/* Líneas */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 16 }}>
        <div style={panelHead}>Líneas · {lineas.length} producto(s)</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: ff.mono, fontSize: 11 }}>
            <thead><tr>
              {['Producto', 'Cant.', 'Ud.', '€/ud', 'Total', 'Ingrediente mapeado', 'Almacén', 'Cambio precio'].map((h, i) => (
                <th key={h} style={{ ...th, textAlign: [1, 3, 4, 7].includes(i) ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {lineas.map((l: any) => (
                <tr key={l.id} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                  <td style={td}>{l.nombre || '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{l.cantidad ?? '—'}</td>
                  <td style={td}>{l.unidad || '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmt(l.precio_unitario)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmt(l.total_linea)}</td>
                  <td style={td}>
                    {l.ingrediente_id ? (
                      <Link href={`/dashboard/ingredientes/${l.ingrediente_id}`} style={{ color: tk.appleDeep, textDecoration: 'none', fontWeight: 600 }}>
                        {l.ing_descr || l.ingrediente_nombre}
                      </Link>
                    ) : (
                      <span style={{ color: tk.clay }}>sin mapear</span>
                    )}
                  </td>
                  <td style={td}>{l.almacen_destino || l.ing_almacen || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: l.cambio_pct == null ? tk.iron40 : l.cambio_pct > 0 ? tk.terra : tk.appleDeep }}>
                    {l.cambio_pct == null ? '—' : `${l.cambio_pct > 0 ? '+' : ''}${l.cambio_pct}%`}
                  </td>
                </tr>
              ))}
              {lineas.length === 0 && <tr><td colSpan={8} style={{ padding: 22, textAlign: 'center', color: tk.iron40 }}>Sin líneas registradas para este documento.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Impacto */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}` }}>
        <div style={panelHead}>Impacto en costes</div>
        <div style={{ padding: 16 }}>
          {impacto.precios.length === 0 ? (
            <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.iron40, margin: 0 }}>Este documento no actualizó ningún coste de ingrediente.</p>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: ff.mono, fontSize: 11, marginBottom: 18 }}>
                <thead><tr>
                  {['Ingrediente', 'Precio anterior', 'Precio nuevo', 'Variación', 'Fecha'].map((h, i) => (
                    <th key={h} style={{ ...th, textAlign: i === 0 || i === 4 ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {impacto.precios.map((p: any) => {
                    const delta = p.precio_anterior != null && p.precio_anterior > 0
                      ? Math.round(((p.precio - p.precio_anterior) / p.precio_anterior) * 1000) / 10
                      : null
                    return (
                      <tr key={p.id} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                        <td style={td}>
                          {p.ingrediente_id
                            ? <Link href={`/dashboard/ingredientes/${p.ingrediente_id}`} style={{ color: tk.appleDeep, textDecoration: 'none', fontWeight: 600 }}>{p.nombre}</Link>
                            : p.nombre}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>{p.precio_anterior != null ? `${fmt(p.precio_anterior)}/${p.unidad || 'ud'}` : '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{`${fmt(p.precio)}/${p.unidad || 'ud'}`}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: delta == null ? tk.iron40 : delta > 0 ? tk.terra : tk.appleDeep }}>
                          {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}
                        </td>
                        <td style={td}>{p.fecha || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.14em', color: tk.iron40, textTransform: 'uppercase', margin: '0 0 8px' }}>
                Escandallos afectados · {impacto.recetas.length}
              </p>
              {impacto.recetas.length === 0 ? (
                <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.iron40, margin: 0 }}>Ningún escandallo usa los ingredientes actualizados.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {impacto.recetas.map((r: any) => (
                    <Link key={r.id} href="/dashboard/sangrado" style={{ fontFamily: ff.mono, fontSize: 11.5, padding: '6px 12px', background: tk.claySoft, border: `1.5px solid ${tk.clay}`, color: tk.clay, textDecoration: 'none', fontWeight: 600 }}>
                      {r.nombre} →
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: ff.mono, fontSize: 13, color: tk.iron }}>{value}</div>
    </div>
  )
}

const panelHead: React.CSSProperties = { padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.iron, textTransform: 'uppercase' }
const th: React.CSSProperties = { padding: '8px 12px', fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.1em', color: tk.iron40, textTransform: 'uppercase', fontWeight: 400, background: tk.creamSoft, borderBottom: `1px solid ${tk.iron20}` }
const td: React.CSSProperties = { padding: '7px 12px', color: tk.iron, fontVariantNumeric: 'tabular-nums', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
