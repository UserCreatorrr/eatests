'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { tk, ff } from '@/lib/design'

const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)

export default function ProveedorFichaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`/api/proveedores/${id}`)
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setData(d) })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ padding: 36, fontFamily: ff.mono, color: tk.iron60 }}>Cargando…</div>
  if (err || !data) return <div style={{ padding: 36, fontFamily: ff.mono, color: tk.terra }}>{err || 'No encontrado'}</div>

  const p = data.proveedor
  const t = data.totals

  return (
    <div style={{ padding: '32px 36px 60px' }}>
      {/* Volver */}
      <Link href="/dashboard/proveedores" style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, textDecoration: 'none', letterSpacing: '0.04em' }}>← Proveedores</Link>

      {/* Header ficha */}
      <div style={{ background: tk.iron, color: tk.cream, padding: '22px 26px', marginTop: 12, marginBottom: 18, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(to right, rgba(223,213,201,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(223,213,201,0.06) 1px, transparent 1px)`, backgroundSize: '14px 14px' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.18em', color: tk.apple, margin: '0 0 6px', textTransform: 'uppercase' }}>
              FICHA DE PROVEEDOR{p.descr_type ? ` · ${p.descr_type}` : ''}
            </p>
            <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 28, margin: 0, letterSpacing: '-0.02em' }}>{p.descr}</h1>
            <p style={{ fontFamily: ff.mono, fontSize: 11.5, opacity: 0.65, margin: '8px 0 0' }}>
              {[p.nif && `NIF ${p.nif}`, p.contact, p.phone, p.mail].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
            </p>
            {(p.address || p.city) && (
              <p style={{ fontFamily: ff.mono, fontSize: 10.5, opacity: 0.45, margin: '4px 0 0' }}>
                {[p.address, p.city, p.cp].filter(Boolean).join(', ')}{p.web ? ` · ${p.web}` : ''}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <p style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', opacity: 0.5, textTransform: 'uppercase', margin: 0 }}>Gasto total</p>
            <p style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 26, color: tk.apple, margin: '4px 0 0' }}>{fmt(t.gasto_total || 0)}</p>
            {t.facturas_pendientes > 0 && (
              <p style={{ fontFamily: ff.mono, fontSize: 11, color: '#fca5a5', margin: '4px 0 0' }}>
                {t.facturas_pendientes} factura{t.facturas_pendientes !== 1 ? 's' : ''} sin pagar · {fmt(t.importe_pendiente || 0)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Resumen contadores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: `1.5px solid ${tk.iron}`, marginBottom: 18 }}>
        {[
          ['INGREDIENTES', t.ingredientes],
          ['PEDIDOS', t.pedidos],
          ['ALBARANES', t.albaranes],
          ['FACTURAS', t.facturas],
        ].map(([l, v], i) => (
          <div key={i} style={{ padding: '16px 20px', borderRight: i < 3 ? `1.5px solid ${tk.iron20}` : 'none', background: tk.paper }}>
            <div style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.14em', color: tk.iron40, textTransform: 'uppercase' }}>{l as string}</div>
            <div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 28, color: tk.iron, margin: '4px 0 0' }}>{v as number}</div>
          </div>
        ))}
      </div>

      {/* Ingredientes asociados + últimos precios */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18, alignItems: 'start' }}>
        <Panel title={`Ingredientes asociados (${data.ingredientes.length})`}>
          {data.ingredientes.length === 0 ? <Empty text="Sin ingredientes asignados a este proveedor" /> : (
            <Tbl head={['Ingrediente', 'Almacén', 'Coste']}>
              {data.ingredientes.slice(0, 30).map((i: any) => (
                <Row key={i.id} cells={[i.descr, i.almacen_principal || '—', i.cost != null ? `${fmt(i.cost)}/${i.unit || 'ud'}` : '—']} rightCols={[2]} />
              ))}
            </Tbl>
          )}
        </Panel>

        <Panel title="Últimos precios y cambios">
          {data.ultimos_precios.length === 0 ? <Empty text="Sin histórico de precios" /> : (
            <Tbl head={['Ingrediente', 'Precio', 'Cambio']}>
              {data.ultimos_precios.map((u: any, idx: number) => (
                <Row key={idx} cells={[
                  u.nombre,
                  fmt(u.precio),
                  u.cambio_pct === 0 ? '—' : `${u.cambio_pct > 0 ? '+' : ''}${u.cambio_pct}%`,
                ]} rightCols={[1, 2]} colColors={{ 2: u.cambio_pct > 0 ? tk.terra : u.cambio_pct < 0 ? tk.appleDeep : tk.iron40 }} />
              ))}
            </Tbl>
          )}
        </Panel>
      </div>

      {/* Facturas */}
      <Panel title={`Facturas (${data.facturas.length})`}>
        {data.facturas.length === 0 ? <Empty text="Sin facturas registradas" /> : (
          <Tbl head={['Nº', 'Fecha', 'Vence', 'Total', 'Estado']}>
            {data.facturas.map((f: any) => (
              <Row key={f.id} cells={[
                f.invoice_num || '—', f.date_invoice || '—', f.date_due || '—', fmt(f.total || 0),
                f.paid ? 'Pagada' : 'Pendiente',
              ]} rightCols={[3]} colColors={{ 4: f.paid ? tk.appleDeep : tk.clay }} />
            ))}
          </Tbl>
        )}
      </Panel>

      {/* Pedidos + Albaranes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 18, alignItems: 'start' }}>
        <Panel title={`Pedidos (${data.pedidos.length})`}>
          {data.pedidos.length === 0 ? <Empty text="Sin pedidos" /> : (
            <Tbl head={['Nº', 'Fecha', 'Total']}>
              {data.pedidos.map((o: any) => <Row key={o.id} cells={[o.num_order || '—', o.date_order || '—', fmt(o.total || 0)]} rightCols={[2]} />)}
            </Tbl>
          )}
        </Panel>
        <Panel title={`Albaranes (${data.albaranes.length})`}>
          {data.albaranes.length === 0 ? <Empty text="Sin albaranes" /> : (
            <Tbl head={['Nº', 'Fecha', 'Total']}>
              {data.albaranes.map((a: any) => <Row key={a.id} cells={[a.delivery_num || '—', a.date_delivery || '—', fmt(a.total || 0)]} rightCols={[2]} />)}
            </Tbl>
          )}
        </Panel>
      </div>

      {p.comment && (
        <div style={{ marginTop: 18, background: tk.creamSoft, border: `1.5px solid ${tk.iron20}`, padding: '14px 18px' }}>
          <p style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.14em', color: tk.iron40, textTransform: 'uppercase', margin: '0 0 6px' }}>Notas / incidencias</p>
          <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.iron, margin: 0, lineHeight: 1.6 }}>{p.comment}</p>
        </div>
      )}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}` }}>
      <div style={{ padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.iron, textTransform: 'uppercase' }}>{title}</div>
      {children}
    </div>
  )
}
function Empty({ text }: { text: string }) {
  return <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: ff.mono, fontSize: 11, color: tk.iron40 }}>{text}</div>
}
function Tbl({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: ff.mono, fontSize: 11.5 }}>
      <thead><tr>{head.map((h, i) => (
        <th key={i} style={{ padding: '8px 14px', textAlign: i === 0 ? 'left' : 'right', fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.1em', color: tk.iron40, textTransform: 'uppercase', fontWeight: 400, background: tk.creamSoft, borderBottom: `1px solid ${tk.iron20}` }}>{h}</th>
      ))}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  )
}
function Row({ cells, rightCols = [], colColors = {} }: { cells: (string | number)[]; rightCols?: number[]; colColors?: Record<number, string> }) {
  return (
    <tr style={{ borderTop: `1px solid ${tk.iron20}` }}>
      {cells.map((c, i) => (
        <td key={i} style={{
          padding: '7px 14px',
          textAlign: i === 0 ? 'left' : (rightCols.includes(i) ? 'right' : 'left'),
          color: colColors[i] || tk.iron, fontVariantNumeric: 'tabular-nums',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220,
        }}>{c}</td>
      ))}
    </tr>
  )
}
