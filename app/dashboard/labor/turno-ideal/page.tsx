'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { tk, ff } from '@/lib/design'

interface Slot {
  slot: string
  servicio: string
  ventas_previstas: number
  target_splh: number
  horas_ideales: number
  coste_ideal: number
  horas_plan: number
  coste_plan: number
  delta_horas: number
  delta_coste: number
  status: 'sobredotacion' | 'subdotacion' | 'ok'
  recomendacion: string
}

const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
const fmtN = (v: number, d = 1) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v)

const FRANJAS_DEFAULT = [
  '09:00–11:00', '11:00–13:00', '13:00–15:00', '15:00–17:00',
  '17:00–19:00', '19:00–21:00', '21:00–23:00',
]

const SAMPLE_FORECAST: Record<string, number> = {
  '09:00–11:00': 250,
  '11:00–13:00': 480,
  '13:00–15:00': 2100,
  '15:00–17:00': 720,
  '17:00–19:00': 380,
  '19:00–21:00': 1850,
  '21:00–23:00': 1620,
}

export default function TurnoIdealPage() {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [siteId, setSiteId] = useState('')
  const [targetSplh, setTargetSplh] = useState(65)
  const [costeMedioHora, setCosteMedioHora] = useState(12)
  const [forecast, setForecast] = useState<Record<string, number>>(
    Object.fromEntries(FRANJAS_DEFAULT.map(f => [f, 0]))
  )
  const [planHoras, setPlanHoras] = useState<Record<string, number>>(
    Object.fromEntries(FRANJAS_DEFAULT.map(f => [f, 0]))
  )

  const [slots, setSlots] = useState<Slot[]>([])
  const [totales, setTotales] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function calc() {
    setLoading(true)
    const payload = {
      fecha, site_id: siteId || undefined,
      target_splh: targetSplh,
      coste_medio_hora: costeMedioHora,
      forecast: Object.entries(forecast).filter(([_, v]) => v > 0).map(([slot, ventas]) => ({ slot, ventas })),
      plan: Object.entries(planHoras).filter(([_, v]) => v > 0).map(([slot, horas]) => ({ slot, horas })),
    }
    const res = await fetch('/api/labor/turno-ideal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setSlots(data.slots || [])
    setTotales(data.totales || null)
    setLoading(false)
  }

  function loadSample() {
    setForecast({ ...SAMPLE_FORECAST })
  }

  const statusColor = (s: Slot['status']) => s === 'sobredotacion' ? tk.terra : s === 'subdotacion' ? tk.clay : tk.appleDeep
  const statusBg = (s: Slot['status']) => s === 'sobredotacion' ? tk.terraSoft : s === 'subdotacion' ? tk.claySoft : tk.appleSoft

  return (
    <div style={{ padding: '32px 36px 60px', maxWidth: 1280 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.2em', color: tk.appleDeep, textTransform: 'uppercase', margin: '0 0 8px' }}>
          LABOR COST · TURNO IDEAL
        </p>
        <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 36, lineHeight: 1.0, letterSpacing: '-0.02em', margin: '0 0 6px', color: tk.iron }}>
          ¿Cuántas horas necesitas hoy?
        </h1>
        <p style={{ fontFamily: ff.mono, fontSize: 12.5, color: tk.iron60, margin: 0, maxWidth: 640 }}>
          Forecast de ventas por franja + objetivo SPLH → horas y coste ideales por franja, alertas de sobre/subdotación.
          <strong style={{ color: tk.iron }}> Sin fichaje.</strong>
        </p>
      </div>

      {/* Config */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, padding: 22, marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <Field label="FECHA"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} /></Field>
          <Field label="CENTRO (OPC.)"><input type="text" value={siteId} onChange={e => setSiteId(e.target.value)} placeholder="MADNUM" style={inputStyle} /></Field>
          <Field label="TARGET SPLH €/H"><input type="number" value={targetSplh} onChange={e => setTargetSplh(parseFloat(e.target.value) || 0)} step="1" style={inputStyle} /></Field>
          <Field label="COSTE MEDIO €/H"><input type="number" value={costeMedioHora} onChange={e => setCosteMedioHora(parseFloat(e.target.value) || 0)} step="0.5" style={inputStyle} /></Field>
        </div>
      </div>

      {/* Forecast por franja */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 18 }}>
        <div style={{ padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.iron, textTransform: 'uppercase' }}>Forecast de ventas + horas planificadas por franja</span>
          <button onClick={loadSample} style={btnGhost}>Rellenar con ejemplo</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontFamily: ff.mono, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={thStyle}>Franja</th>
              <th style={thStyle}>Servicio</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Ventas previstas €</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Horas planificadas</th>
            </tr>
          </thead>
          <tbody>
            {FRANJAS_DEFAULT.map(f => {
              const servicio = serviceForSlot(f.split('–')[0])
              return (
                <tr key={f} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                  <td style={tdStyle}><strong>{f}</strong></td>
                  <td style={{ ...tdStyle, color: tk.iron60 }}>{servicio}</td>
                  <td style={tdStyle}>
                    <input type="number" value={forecast[f] || 0} onChange={e => setForecast(prev => ({ ...prev, [f]: parseFloat(e.target.value) || 0 }))}
                      style={{ ...inputSmall, textAlign: 'right' as const }} step="50" />
                  </td>
                  <td style={tdStyle}>
                    <input type="number" value={planHoras[f] || 0} onChange={e => setPlanHoras(prev => ({ ...prev, [f]: parseFloat(e.target.value) || 0 }))}
                      style={{ ...inputSmall, textAlign: 'right' as const }} step="0.5" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={calc} disabled={loading} style={btnPrimary}>
            {loading ? 'CALCULANDO…' : 'CALCULAR TURNO IDEAL →'}
          </button>
        </div>
      </div>

      {/* Resultado */}
      {slots.length > 0 && (
        <>
          {/* KPIs totales */}
          {totales && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: `1.5px solid ${tk.iron}`, marginBottom: 14 }}>
              <KpiCell label="HORAS IDEALES" value={fmtN(totales.horas_ideales)} sub={`vs ${fmtN(totales.horas_plan)}h plan`} />
              <KpiCell label="COSTE IDEAL" value={fmt(totales.coste_ideal)} sub={`vs ${fmt(totales.coste_plan)} plan`} />
              <KpiCell label="Δ HORAS" value={`${totales.delta_horas > 0 ? '+' : ''}${fmtN(totales.delta_horas)}h`} sub={totales.delta_horas > 0 ? 'exceso' : totales.delta_horas < 0 ? 'falta' : 'óptimo'} variant={totales.delta_horas > 1 ? 'crit' : totales.delta_horas < -0.5 ? 'warn' : 'ok'} />
              <KpiCell label="Δ COSTE" value={`${totales.delta_coste > 0 ? '+' : ''}${fmt(totales.delta_coste)}`} sub={totales.delta_coste > 0 ? 'ahorrable' : 'a reforzar'} variant={Math.abs(totales.delta_coste) > 50 ? 'crit' : 'default'} last />
            </div>
          )}

          {/* Heatmap por franja */}
          <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 14 }}>
            <div style={{ padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.iron, textTransform: 'uppercase' }}>
              Comparativa Plan vs Ideal por franja
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontFamily: ff.mono, fontSize: 11.5 }}>
              <thead><tr>
                <th style={thStyle}>Franja</th>
                <th style={thStyle}>Servicio</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Ventas €</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>H ideal</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>H plan</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Δ H</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Δ €</th>
                <th style={thStyle}>Estado</th>
              </tr></thead>
              <tbody>
                {slots.map((s, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${tk.iron20}`, background: statusBg(s.status) }}>
                    <td style={tdStyle}><strong>{s.slot}</strong></td>
                    <td style={{ ...tdStyle, color: tk.iron60 }}>{s.servicio}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' as const }}>{fmt(s.ventas_previstas)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' as const, fontWeight: 600 }}>{fmtN(s.horas_ideales)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' as const }}>{fmtN(s.horas_plan)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' as const, color: statusColor(s.status), fontWeight: 600 }}>
                      {s.delta_horas > 0 ? '+' : ''}{fmtN(s.delta_horas)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' as const, color: statusColor(s.status) }}>
                      {s.delta_coste > 0 ? '+' : ''}{fmt(s.delta_coste)}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        fontFamily: ff.mono, fontSize: 9, letterSpacing: '0.14em',
                        textTransform: 'uppercase' as const,
                        padding: '3px 7px',
                        border: `1px solid ${statusColor(s.status)}`,
                        color: statusColor(s.status),
                        background: tk.paper,
                      }}>
                        {s.status === 'sobredotacion' ? 'SOBREDOT.' : s.status === 'subdotacion' ? 'SUBDOT.' : 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recomendaciones */}
          <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}` }}>
            <div style={{ padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.iron, textTransform: 'uppercase' }}>
              Recomendaciones accionables
            </div>
            <div style={{ padding: 16 }}>
              {slots.filter(s => s.status !== 'ok').length === 0 ? (
                <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.appleDeep, margin: 0 }}>
                  ✓ Plantilla óptima · no hay franjas sobre o subdotadas.
                </p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16, fontFamily: ff.mono, fontSize: 12, lineHeight: 1.7 }}>
                  {slots.filter(s => s.status !== 'ok').map((s, i) => (
                    <li key={i} style={{ color: tk.iron }}>
                      <span style={{ color: statusColor(s.status), fontWeight: 600 }}>{s.slot}</span> · {s.recomendacion}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.14em', color: tk.iron40, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

function KpiCell({ label, value, sub, variant = 'default', last }: { label: string; value: string; sub: string; variant?: 'default' | 'warn' | 'crit' | 'ok'; last?: boolean }) {
  const valueColor = variant === 'crit' ? tk.terra : variant === 'warn' ? tk.clay : variant === 'ok' ? tk.appleDeep : tk.iron
  return (
    <div style={{ padding: '16px 20px', borderRight: last ? 'none' : `1.5px solid ${tk.iron20}`, background: tk.paper }}>
      <div style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.15em', color: tk.iron40, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 28, lineHeight: 1, color: valueColor, margin: '5px 0 3px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60 }}>{sub}</div>
    </div>
  )
}

function serviceForSlot(hm: string): string {
  const [h, m] = hm.split(':').map(Number)
  const mins = h * 60 + m
  if (mins < 11 * 60) return 'Desayuno'
  if (mins < 16 * 60) return 'Comida'
  if (mins < 19 * 60) return 'Entre servicios'
  return 'Cena'
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', fontFamily: ff.mono, fontSize: 12, border: `1.5px solid ${tk.iron20}`, background: tk.cream, color: tk.iron, outline: 'none' }
const inputSmall: React.CSSProperties = { width: 110, padding: '5px 8px', fontFamily: ff.mono, fontSize: 11.5, border: `1px solid ${tk.iron20}`, background: tk.cream, color: tk.iron, outline: 'none', fontVariantNumeric: 'tabular-nums' }
const thStyle: React.CSSProperties = { padding: '9px 14px', textAlign: 'left' as const, fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase' as const, fontWeight: 400, background: tk.creamSoft, borderBottom: `1px solid ${tk.iron20}` }
const tdStyle: React.CSSProperties = { padding: '8px 14px', color: tk.iron, fontVariantNumeric: 'tabular-nums' as const }
const btnPrimary: React.CSSProperties = { padding: '9px 18px', background: tk.apple, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: tk.iron, letterSpacing: '0.08em', cursor: 'pointer' }
const btnGhost: React.CSSProperties = { padding: '6px 12px', background: tk.paper, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 10.5, fontWeight: 600, color: tk.iron, letterSpacing: '0.06em', cursor: 'pointer' }
