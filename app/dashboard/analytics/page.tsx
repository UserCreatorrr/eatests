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
  const p = ym?.split('-')
  return p?.length >= 2 ? (MESES_CORTOS[p[1]] || ym) : ym
}
function eur(v: number | null | undefined) {
  if (v == null) return '0 €'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}
const PIE_COLORS = ['#19f973', '#3d3834', '#a8e6cf', '#88d4b0', '#5bc4a0', '#38b48e', '#1a9478', '#0a7460']

const MOTIVOS = ['caducidad', 'sobreproducción', 'rotura', 'pérdida', 'otro']
const MOTIVO_COLORS: Record<string, string> = {
  caducidad: '#ef4444', sobreproducción: '#f97316', rotura: '#eab308', pérdida: '#8b5cf6', otro: '#6b7280',
}

const card: React.CSSProperties = { backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 16, padding: 24 }
const mono = (size = 11): React.CSSProperties => ({ fontFamily: 'DM Mono, monospace', fontSize: size })
const chillax = (size = 14, weight = 700): React.CSSProperties => ({ fontFamily: 'Chillax, sans-serif', fontWeight: weight, fontSize: size })
const label: React.CSSProperties = { ...mono(10), textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 8px', letterSpacing: 1 }

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ ...mono(10), padding: '2px 7px', borderRadius: 6, backgroundColor: color + '22', color, fontWeight: 700 }}>{children}</span>
  )
}

// ─── TAB: RESUMEN ────────────────────────────────────────────────────────────
function TabResumen() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ ...mono(), color: '#3d3834', opacity: 0.4, padding: 40, textAlign: 'center' }}>Cargando…</div>

  const kpis = data?.kpis ?? {}
  const facturaStats = data?.facturaStats ?? {}
  const variacionPct = kpis.gasto_mes_anterior > 0
    ? Math.round(((kpis.gasto_este_mes - kpis.gasto_mes_anterior) / kpis.gasto_mes_anterior) * 100)
    : null
  const topMax = data?.topProveedores?.[0]?.total ?? 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={card}>
          <p style={label}>Gasto este mes</p>
          <p style={{ ...chillax(28), color: '#3d3834', margin: '0 0 8px' }}>{eur(kpis.gasto_este_mes)}</p>
          {variacionPct !== null && (
            <Badge color={variacionPct > 0 ? '#dc2626' : '#16a34a'}>
              {variacionPct > 0 ? '▲' : '▼'} {Math.abs(variacionPct)}% vs mes anterior
            </Badge>
          )}
        </div>
        <div style={card}>
          <p style={label}>Facturas pendientes</p>
          <p style={{ ...chillax(28), color: '#3d3834', margin: '0 0 8px' }}>{facturaStats.pendientes ?? 0}</p>
          {(facturaStats.importe_pendiente ?? 0) > 0 && (
            <p style={{ ...mono(10), color: '#dc2626', margin: 0 }}>por valor de {eur(facturaStats.importe_pendiente)}</p>
          )}
        </div>
        <div style={card}>
          <p style={label}>Ingredientes sin coste</p>
          <p style={{ ...chillax(28), color: '#3d3834', margin: '0 0 8px' }}>
            {kpis.ingredientes_sin_coste} <span style={{ fontSize: 16, opacity: 0.4 }}>/ {kpis.total_ingredientes}</span>
          </p>
          <a href="/dashboard/ingredientes" style={{ ...mono(10), color: '#19f973', textDecoration: 'none', fontWeight: 700 }}>Completar →</a>
        </div>
        <div style={card}>
          <p style={label}>Recetas activas</p>
          <p style={{ ...chillax(28), color: '#3d3834', margin: '0 0 8px' }}>{kpis.recetas_activas}</p>
          <a href="/dashboard/sangrado" style={{ ...mono(10), color: '#19f973', textDecoration: 'none', fontWeight: 700 }}>Ver recetas →</a>
        </div>
      </div>

      {/* Bar chart */}
      <div style={card}>
        <p style={label}>Gasto en compras — últimos 12 meses</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={(data?.gastoMensual ?? []).map((d: any) => ({ ...d, mesCorto: mesCorto(d.mes) }))}>
            <XAxis dataKey="mesCorto" tick={{ ...mono(10), fill: '#3d3834', opacity: 0.5 } as any} axisLine={false} tickLine={false} />
            <YAxis tick={{ ...mono(10), fill: '#3d3834', opacity: 0.5 } as any} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k€` : `${v}€`} width={48} />
            <Tooltip formatter={(v: any) => eur(v)} contentStyle={{ fontFamily: 'DM Mono, monospace', fontSize: 11, borderRadius: 10, border: '1px solid #e8e2db' }} />
            <Bar dataKey="total" fill="#19f973" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie + Top */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        <div style={card}>
          <p style={label}>Gasto por proveedor este mes</p>
          {!(data?.gastoPorMesActual?.length) ? (
            <div style={{ ...mono(), color: '#3d3834', opacity: 0.4, textAlign: 'center', padding: '40px 0' }}>Sin pedidos este mes</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.gastoPorMesActual} dataKey="total" nameKey="vendor" cx="50%" cy="45%" outerRadius={90} paddingAngle={2}>
                  {data.gastoPorMesActual.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend formatter={(v) => <span style={mono(11)}>{v}</span>} />
                <Tooltip formatter={(v: any) => eur(v)} contentStyle={{ fontFamily: 'DM Mono, monospace', fontSize: 11, borderRadius: 10, border: '1px solid #e8e2db' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div style={card}>
          <p style={label}>Top proveedores (histórico)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(data?.topProveedores ?? []).map((p: any) => (
              <div key={p.vendor}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div>
                    <p style={{ ...mono(12), fontWeight: 700, color: '#3d3834', margin: '0 0 2px' }}>{p.vendor}</p>
                    <p style={{ ...mono(10), color: '#3d3834', opacity: 0.4, margin: 0 }}>{p.pedidos} pedidos</p>
                  </div>
                  <p style={{ ...chillax(14), color: '#3d3834', margin: 0 }}>{eur(p.total)}</p>
                </div>
                <div style={{ height: 4, borderRadius: 2, backgroundColor: '#f5f2ee' }}>
                  <div style={{ height: '100%', borderRadius: 2, backgroundColor: '#19f973', width: `${Math.round((p.total / topMax) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: DESVIACIONES DE PRECIO ─────────────────────────────────────────────
function TabDesviaciones() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics/deviaciones').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ ...mono(), color: '#3d3834', opacity: 0.4, padding: 40, textAlign: 'center' }}>Analizando precios…</div>

  const desviaciones: any[] = data?.desviaciones ?? []
  const vendorTrend: any[] = data?.vendorTrend ?? []
  const inconsistencias: any[] = data?.inconsistencias ?? []
  const sinDatos = desviaciones.length === 0 && vendorTrend.length === 0 && inconsistencias.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sinDatos && (
        <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ ...chillax(16), color: '#3d3834', marginBottom: 8 }}>Sin datos de desviación aún</p>
          <p style={{ ...mono(), color: '#3d3834', opacity: 0.5, maxWidth: 400, margin: '0 auto' }}>
            Las desviaciones se detectan automáticamente cuando la IA escanea albaranes con foto
            o cuando actualizas precios de ingredientes. Prueba a enviar una foto de un albarán al chat.
          </p>
        </div>
      )}

      {/* Desviaciones de precio por ingrediente */}
      {desviaciones.length > 0 && (
        <div style={card}>
          <p style={label}>Subidas de precio detectadas en ingredientes</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {desviaciones.map((d: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < desviaciones.length - 1 ? '1px solid #f0ebe4' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ ...mono(12), fontWeight: 700, color: '#3d3834', margin: '0 0 2px' }}>{d.nombre}</p>
                  <p style={{ ...mono(10), color: '#3d3834', opacity: 0.5, margin: 0 }}>{d.vendor || 'Sin proveedor'} · {d.fecha}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ ...mono(11), color: '#3d3834', margin: '0 0 4px' }}>
                    <span style={{ opacity: 0.5, textDecoration: 'line-through' }}>{d.precio_anterior}€</span>
                    {' → '}
                    <strong>{d.precio_actual}€</strong>
                    {d.unidad && <span style={{ opacity: 0.4 }}>/{d.unidad}</span>}
                  </p>
                  <Badge color={d.variacion_pct > 0 ? '#dc2626' : '#16a34a'}>
                    {d.variacion_pct > 0 ? '▲' : '▼'} {Math.abs(d.variacion_pct)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variación gasto por proveedor mes a mes */}
      {vendorTrend.length > 0 && (
        <div style={card}>
          <p style={label}>Variación de gasto por proveedor (mes actual vs anterior)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {vendorTrend.map((v: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < vendorTrend.length - 1 ? '1px solid #f0ebe4' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ ...mono(12), fontWeight: 700, color: '#3d3834', margin: '0 0 2px' }}>{v.vendor}</p>
                  <p style={{ ...mono(10), color: '#3d3834', opacity: 0.5, margin: 0 }}>
                    Anterior: {eur(v.mes_anterior)} → Actual: {eur(v.este_mes)}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <Badge color={v.variacion_pct > 0 ? '#dc2626' : '#16a34a'}>
                    {v.variacion_pct > 0 ? '▲' : '▼'} {Math.abs(v.variacion_pct)}%
                  </Badge>
                  <span style={{ ...mono(10), color: v.variacion_eur > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                    {v.variacion_eur > 0 ? '+' : ''}{eur(v.variacion_eur)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inconsistencias entre proveedores */}
      {inconsistencias.length > 0 && (
        <div style={card}>
          <p style={label}>Mismo producto, precios distintos entre proveedores</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {inconsistencias.map((inc: any, i: number) => (
              <div key={i} style={{ padding: 16, backgroundColor: '#fff9f0', borderRadius: 10, border: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ ...mono(12), fontWeight: 700, color: '#3d3834', margin: 0 }}>{inc.nombre}</p>
                  <Badge color='#f97316'>Diferencia {inc.diff_pct}%</Badge>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  {inc.vendors.map((v: any, j: number) => (
                    <p key={j} style={{ ...mono(10), color: '#3d3834', margin: 0 }}>
                      {v.vendor}: <strong>{v.precio}€</strong>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB: MERMA ───────────────────────────────────────────────────────────────
function TabMerma() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', cantidad: '', unidad: 'kg', motivo: 'caducidad', coste_estimado: '', notas: '' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    fetch('/api/merma').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function guardar() {
    if (!form.nombre) return
    setSaving(true)
    await fetch('/api/merma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, cantidad: parseFloat(form.cantidad) || null, coste_estimado: parseFloat(form.coste_estimado) || null }),
    })
    setForm({ nombre: '', cantidad: '', unidad: 'kg', motivo: 'caducidad', coste_estimado: '', notas: '' })
    setSaving(false)
    load()
  }

  async function eliminar(id: number) {
    await fetch('/api/merma', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  if (loading) return <div style={{ ...mono(), color: '#3d3834', opacity: 0.4, padding: 40, textAlign: 'center' }}>Cargando…</div>

  const inputStyle: React.CSSProperties = { ...mono(12), width: '100%', padding: '8px 12px', border: '1px solid #e8e2db', borderRadius: 8, outline: 'none', backgroundColor: '#faf9f7', color: '#3d3834', boxSizing: 'border-box' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <div style={card}>
          <p style={label}>Merma este mes</p>
          <p style={{ ...chillax(28), color: '#dc2626', margin: '0 0 4px' }}>{eur(data?.totalMes?.t)}</p>
          <p style={{ ...mono(10), color: '#3d3834', opacity: 0.5, margin: 0 }}>{data?.totalMes?.n ?? 0} eventos registrados</p>
        </div>
        <div style={card}>
          <p style={label}>Merma este año</p>
          <p style={{ ...chillax(28), color: '#3d3834', margin: 0 }}>{eur(data?.totalAno?.t)}</p>
        </div>
        {(data?.topProductos ?? []).length > 0 && (
          <div style={card}>
            <p style={label}>Mayor pérdida este mes</p>
            <p style={{ ...chillax(16), color: '#3d3834', margin: '0 0 4px' }}>{data.topProductos[0].nombre}</p>
            <p style={{ ...mono(10), color: '#dc2626', margin: 0, fontWeight: 700 }}>{eur(data.topProductos[0].coste_total)}</p>
          </div>
        )}
      </div>

      {/* Registro rápido */}
      <div style={card}>
        <p style={{ ...label, marginBottom: 16 }}>Registrar merma</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
          <input placeholder="Producto *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} style={inputStyle} />
          <input placeholder="Cantidad" type="number" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} style={inputStyle} />
          <select value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} style={inputStyle}>
            {['kg', 'g', 'l', 'ml', 'ud', 'caja', 'bandeja'].map(u => <option key={u}>{u}</option>)}
          </select>
          <select value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} style={inputStyle}>
            {MOTIVOS.map(m => <option key={m}>{m}</option>)}
          </select>
          <input placeholder="Coste estimado (€)" type="number" value={form.coste_estimado} onChange={e => setForm(f => ({ ...f, coste_estimado: e.target.value }))} style={inputStyle} />
          <input placeholder="Notas" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} style={inputStyle} />
        </div>
        <button onClick={guardar} disabled={saving || !form.nombre} style={{ ...mono(12), padding: '8px 20px', backgroundColor: '#19f973', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#2a2522', fontWeight: 700 }}>
          {saving ? 'Guardando…' : 'Registrar pérdida'}
        </button>
      </div>

      {/* Breakdown por motivo */}
      {(data?.statsMes ?? []).length > 0 && (
        <div style={card}>
          <p style={label}>Distribución por motivo (este mes)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.statsMes.map((s: any) => {
              const color = MOTIVO_COLORS[s.motivo] ?? '#6b7280'
              const pct = data.totalMes.t > 0 ? Math.round((s.coste_total / data.totalMes.t) * 100) : 0
              return (
                <div key={s.motivo}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ ...mono(11), fontWeight: 700, color }}>{s.motivo}</span>
                    <span style={{ ...mono(11), color: '#3d3834' }}>{eur(s.coste_total)} · {s.n} eventos</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, backgroundColor: '#f0ebe4' }}>
                    <div style={{ height: '100%', borderRadius: 3, backgroundColor: color, width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista registros */}
      {(data?.registros ?? []).length > 0 && (
        <div style={card}>
          <p style={label}>Últimos registros</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {data.registros.map((r: any, i: number) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < data.registros.length - 1 ? '1px solid #f0ebe4' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ ...mono(12), fontWeight: 700, color: '#3d3834', margin: '0 0 2px' }}>{r.nombre}</p>
                  <p style={{ ...mono(10), color: '#3d3834', opacity: 0.5, margin: 0 }}>
                    {r.cantidad ? `${r.cantidad} ${r.unidad || ''}` : ''} · {r.fecha}
                    {r.notas ? ` · ${r.notas}` : ''}
                  </p>
                </div>
                <Badge color={MOTIVO_COLORS[r.motivo] ?? '#6b7280'}>{r.motivo || 'otro'}</Badge>
                {r.coste_estimado != null && (
                  <span style={{ ...mono(12), fontWeight: 700, color: '#dc2626' }}>{eur(r.coste_estimado)}</span>
                )}
                <button onClick={() => eliminar(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3d3834', opacity: 0.3, fontSize: 16, padding: '0 4px' }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB: CONSUMO TEÓRICO ─────────────────────────────────────────────────────
function TabConsumo() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', raciones: '' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    fetch('/api/consumo').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function registrarProduccion() {
    if (!form.nombre || !form.raciones) return
    setSaving(true)
    const receta = data?.recetas?.find((r: any) => r.nombre.toLowerCase().includes(form.nombre.toLowerCase()))
    await fetch('/api/consumo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receta_id: receta?.id ?? null, nombre: form.nombre, raciones: parseInt(form.raciones) }),
    })
    setForm({ nombre: '', raciones: '' })
    setSaving(false)
    load()
  }

  if (loading) return <div style={{ ...mono(), color: '#3d3834', opacity: 0.4, padding: 40, textAlign: 'center' }}>Calculando consumos…</div>

  const inputStyle: React.CSSProperties = { ...mono(12), padding: '8px 12px', border: '1px solid #e8e2db', borderRadius: 8, outline: 'none', backgroundColor: '#faf9f7', color: '#3d3834' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Explanation */}
      <div style={{ ...card, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
        <p style={{ ...mono(11), color: '#16a34a', margin: 0 }}>
          <strong>Cómo funciona:</strong> Registra las raciones producidas de cada receta. La app calcula el consumo teórico de ingredientes
          y lo compara con tus compras reales para detectar fugas de margen.
        </p>
      </div>

      {/* Registrar producción */}
      <div style={card}>
        <p style={{ ...label, marginBottom: 12 }}>Registrar producción del día</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input list="recetas-list" placeholder="Nombre de receta" value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
          <datalist id="recetas-list">
            {(data?.recetas ?? []).map((r: any) => <option key={r.id} value={r.nombre} />)}
          </datalist>
          <input placeholder="Raciones" type="number" value={form.raciones}
            onChange={e => setForm(f => ({ ...f, raciones: e.target.value }))} style={{ ...inputStyle, width: 120 }} />
          <button onClick={registrarProduccion} disabled={saving || !form.nombre || !form.raciones}
            style={{ ...mono(12), padding: '8px 20px', backgroundColor: '#19f973', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#2a2522', fontWeight: 700 }}>
            {saving ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </div>

      {/* Escandallo food cost */}
      {(data?.recetas ?? []).length > 0 && (
        <div style={card}>
          <p style={label}>Food cost por receta</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {data.recetas.filter((r: any) => r.lineas.length > 0).map((r: any, i: number, arr: any[]) => (
              <div key={r.id} style={{ padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid #f0ebe4' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ ...mono(12), fontWeight: 700, color: '#3d3834', margin: '0 0 2px' }}>{r.nombre}</p>
                    <p style={{ ...mono(10), color: '#3d3834', opacity: 0.5, margin: 0 }}>
                      {r.raciones} raciones · Coste: {eur(r.coste_real)} · PVP: {r.precio_venta ? eur(r.precio_venta) : 'sin precio'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {r.food_cost_pct !== null && (
                      <Badge color={r.food_cost_pct > 35 ? '#dc2626' : r.food_cost_pct > 28 ? '#f97316' : '#16a34a'}>
                        FC {r.food_cost_pct}%
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Producción este mes */}
      {(data?.produccion ?? []).length > 0 && (
        <div style={card}>
          <p style={label}>Producción registrada este mes</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.produccion.map((p: any) => (
              <div key={p.nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ ...mono(12), color: '#3d3834' }}>{p.nombre}</span>
                <span style={{ ...mono(11), color: '#3d3834', opacity: 0.6 }}>{p.total_raciones} raciones</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparativa teórico vs real */}
      {(data?.comparativa ?? []).length > 0 && (
        <div style={card}>
          <p style={label}>Consumo teórico vs compras reales</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Ingrediente', 'Teórico', 'Real comprado', 'Diferencia'].map(h => (
                    <th key={h} style={{ ...mono(10), textAlign: 'left', padding: '8px 12px', color: '#3d3834', opacity: 0.5, borderBottom: '1px solid #f0ebe4' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.comparativa.map((c: any, i: number) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#faf9f7' : '#fff' }}>
                    <td style={{ ...mono(12), padding: '8px 12px', color: '#3d3834', fontWeight: 700 }}>{c.ingrediente}</td>
                    <td style={{ ...mono(11), padding: '8px 12px', color: '#3d3834' }}>{c.consumo_teorico}</td>
                    <td style={{ ...mono(11), padding: '8px 12px', color: '#3d3834' }}>{c.consumo_real ?? '—'}</td>
                    <td style={{ ...mono(11), padding: '8px 12px', fontWeight: 700, color: c.diferencia > 0 ? '#dc2626' : '#16a34a' }}>
                      {c.diferencia != null ? (c.diferencia > 0 ? '+' : '') + c.diferencia : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!data?.tiene_datos_produccion && (
        <div style={{ ...card, textAlign: 'center', padding: '32px 24px', opacity: 0.7 }}>
          <p style={{ ...mono(), color: '#3d3834' }}>Registra la producción diaria para ver el análisis de consumo teórico vs real.</p>
        </div>
      )}
    </div>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'desviaciones', label: 'Desviaciones de precio' },
  { key: 'merma', label: 'Merma y desperdicio' },
  { key: 'consumo', label: 'Consumo teórico' },
]

export default function AnalyticsPage() {
  const [tab, setTab] = useState('resumen')

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Control de márgenes y costes</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e8e2db', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...mono(12),
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: tab === t.key ? '#19f973' : '#3d3834',
              borderBottom: tab === t.key ? '2px solid #19f973' : '2px solid transparent',
              fontWeight: tab === t.key ? 700 : 400,
              marginBottom: -1,
              transition: 'all .15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && <TabResumen />}
      {tab === 'desviaciones' && <TabDesviaciones />}
      {tab === 'merma' && <TabMerma />}
      {tab === 'consumo' && <TabConsumo />}
    </div>
  )
}
