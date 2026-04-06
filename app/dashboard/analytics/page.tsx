'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const MESES_CORTOS: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}

function mesCorto(ym: string) {
  const parts = ym?.split('-')
  if (!parts || parts.length < 2) return ym
  return MESES_CORTOS[parts[1]] || ym
}

function eur(v: number | null | undefined) {
  if (v == null) return '0 €'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}

const PIE_COLORS = ['#19f973', '#3d3834', '#a8e6cf', '#88d4b0', '#5bc4a0', '#38b48e', '#1a9478', '#0a7460']

function CustomBarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ backgroundColor: '#faf9f7', border: '1px solid #e8e2db', borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 13, color: '#3d3834', margin: '0 0 4px' }}>{mesCorto(d.mes)} {d.mes?.split('-')[0]}</p>
      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', margin: '0 0 2px' }}>{eur(d.total)}</p>
      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.5, margin: 0 }}>{d.num_pedidos} pedidos</p>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 16, padding: 24 }}>
      <div style={{ height: 10, width: '60%', backgroundColor: '#f0ebe4', borderRadius: 6, marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
      <div style={{ height: 28, width: '80%', backgroundColor: '#f0ebe4', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
    </div>
  )
}

function SkeletonChart({ height = 280 }: { height?: number }) {
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 16, padding: 24, height }} />
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function load() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/analytics')
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const kpis = data?.kpis ?? {}
  const facturaStats = data?.facturaStats ?? {}

  const variacionPct = kpis.gasto_mes_anterior > 0
    ? Math.round(((kpis.gasto_este_mes - kpis.gasto_mes_anterior) / kpis.gasto_mes_anterior) * 100)
    : null

  const topMax = (data?.topProveedores?.[0]?.total ?? 1) || 1

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Rendimiento de cocina</p>
      </div>

      {error && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0' }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#3d3834', opacity: 0.6 }}>No se pudieron cargar los datos</p>
          <button onClick={load} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, padding: '8px 20px', backgroundColor: '#19f973', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#2a2522', fontWeight: 700 }}>
            Reintentar
          </button>
        </div>
      )}

      {!error && (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            {loading ? (
              <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
            ) : (
              <>
                {/* Card 1 */}
                <div style={{ backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 16, padding: 24, transition: 'box-shadow .2s' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 8px', letterSpacing: 1 }}>Gasto este mes</p>
                  <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 28, color: '#3d3834', margin: '0 0 8px' }}>{eur(kpis.gasto_este_mes)}</p>
                  {variacionPct !== null && (
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, backgroundColor: variacionPct > 0 ? '#fef2f2' : '#f0fdf4', color: variacionPct > 0 ? '#dc2626' : '#16a34a' }}>
                      {variacionPct > 0 ? '▲' : '▼'} {Math.abs(variacionPct)}% vs mes anterior
                    </span>
                  )}
                </div>

                {/* Card 2 */}
                <div style={{ backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 16, padding: 24, transition: 'box-shadow .2s' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 8px', letterSpacing: 1 }}>Facturas pendientes</p>
                  <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 28, color: '#3d3834', margin: '0 0 8px' }}>{facturaStats.pendientes ?? 0}</p>
                  {(facturaStats.importe_pendiente ?? 0) > 0 && (
                    <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#dc2626', margin: 0 }}>por valor de {eur(facturaStats.importe_pendiente)}</p>
                  )}
                </div>

                {/* Card 3 */}
                <div style={{ backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 16, padding: 24, transition: 'box-shadow .2s' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 8px', letterSpacing: 1 }}>Ingredientes sin coste</p>
                  <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 28, color: '#3d3834', margin: '0 0 8px' }}>
                    {kpis.ingredientes_sin_coste} <span style={{ fontSize: 16, opacity: 0.4 }}>/ {kpis.total_ingredientes}</span>
                  </p>
                  <a href="/dashboard/ingredientes" style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#19f973', textDecoration: 'none', fontWeight: 700 }}>Completar →</a>
                </div>

                {/* Card 4 */}
                <div style={{ backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 16, padding: 24, transition: 'box-shadow .2s' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 8px', letterSpacing: 1 }}>Recetas activas</p>
                  <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 28, color: '#3d3834', margin: '0 0 8px' }}>{kpis.recetas_activas}</p>
                  <a href="/dashboard/sangrado" style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#19f973', textDecoration: 'none', fontWeight: 700 }}>Ver recetas →</a>
                </div>
              </>
            )}
          </div>

          {/* Bar chart */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 16, padding: 24, marginBottom: 28 }}>
            {loading ? <SkeletonChart /> : (
              <>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 20px', letterSpacing: 1 }}>
                  Gasto en compras — ultimos 12 meses
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={(data?.gastoMensual ?? []).map((d: any) => ({ ...d, mesCorto: mesCorto(d.mes) }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="mesCorto" tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fill: '#3d3834', opacity: 0.5 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fill: '#3d3834', opacity: 0.5 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k€` : `${v}€`} width={48} />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#f5f2ee' }} />
                    <Bar dataKey="total" fill="#19f973" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>

          {/* Pie + Top proveedores */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 28 }}>
            {/* Pie */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 16, padding: 24 }}>
              {loading ? <SkeletonChart height={320} /> : (
                <>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 16px', letterSpacing: 1 }}>
                    Gasto por proveedor este mes
                  </p>
                  {(data?.gastoPorMesActual ?? []).length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.4 }}>
                      Sin pedidos este mes
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={data.gastoPorMesActual} dataKey="total" nameKey="vendor" cx="50%" cy="45%" outerRadius={90} paddingAngle={2}>
                          {data.gastoPorMesActual.map((_: any, i: number) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend formatter={(v) => <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834' }}>{v}</span>} />
                        <Tooltip formatter={(v: any) => eur(v)} contentStyle={{ fontFamily: 'DM Mono, monospace', fontSize: 11, borderRadius: 10, border: '1px solid #e8e2db' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </>
              )}
            </div>

            {/* Top proveedores */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 16, padding: 24 }}>
              {loading ? <SkeletonChart height={320} /> : (
                <>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 20px', letterSpacing: 1 }}>
                    Top proveedores (historico)
                  </p>
                  {(data?.topProveedores ?? []).length === 0 ? (
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.4, textAlign: 'center', paddingTop: 40 }}>Sin datos</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      {(data.topProveedores as any[]).map((p: any) => (
                        <div key={p.vendor}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <div>
                              <p style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 12, color: '#3d3834', margin: '0 0 2px' }}>{p.vendor}</p>
                              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.4, margin: 0 }}>{p.pedidos} pedidos</p>
                            </div>
                            <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 14, color: '#3d3834', margin: 0 }}>{eur(p.total)}</p>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, backgroundColor: '#f5f2ee', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 2, backgroundColor: '#19f973', width: `${Math.round((p.total / topMax) * 100)}%`, transition: 'width .6s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Estado facturas */}
          {!loading && (
            <div style={{ backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 16, padding: 24 }}>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 16px', letterSpacing: 1 }}>
                Estado de facturas de compra
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834' }}>
                  Pagadas <strong>{facturaStats.pagadas ?? 0}</strong> / <strong>{facturaStats.total ?? 0}</strong>
                </span>
                {(facturaStats.importe_pendiente ?? 0) > 0 && (
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#dc2626', fontWeight: 700 }}>
                    {eur(facturaStats.importe_pendiente)} pendiente
                  </span>
                )}
              </div>
              <div style={{ height: 12, borderRadius: 6, backgroundColor: '#f5f2ee', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 6, backgroundColor: '#19f973',
                  width: facturaStats.total > 0 ? `${Math.round(((facturaStats.pagadas ?? 0) / facturaStats.total) * 100)}%` : '0%',
                  transition: 'width .6s ease',
                }} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
