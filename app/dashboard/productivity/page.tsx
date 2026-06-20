'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { tk, ff } from '@/lib/design'

interface ProductivitySummary {
  splh: number | null
  ventas_por_empleado: number | null
  tickets_por_hora: number | null
  covers_por_hora: number | null
  productividad_index: number | null
  prime_cost_pct: number | null
  coste_ineficiencia: number
  por_franja: { slot: string; ventas: number; horas: number; splh: number | null; target_splh: number | null; status: 'ok' | 'warn' | 'crit' }[]
}

const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
const fmtN = (v: number, d = 1) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v)

export default function ProductivityOverviewPage() {
  const [data, setData] = useState<{ summary: ProductivitySummary; from: string; to: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'7' | '30' | 'mtd'>('7')

  useEffect(() => {
    setLoading(true)
    const today = new Date()
    let from = new Date()
    if (range === '7') from.setDate(today.getDate() - 7)
    else if (range === '30') from.setDate(today.getDate() - 30)
    else from.setDate(1)
    const fromStr = from.toISOString().split('T')[0]
    const toStr = today.toISOString().split('T')[0]
    fetch(`/api/productivity/summary?from=${fromStr}&to=${toStr}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [range])

  const s = data?.summary
  const statusColor = (st: 'ok' | 'warn' | 'crit') => st === 'crit' ? tk.terra : st === 'warn' ? tk.clay : tk.appleDeep
  const statusBg = (st: 'ok' | 'warn' | 'crit') => st === 'crit' ? tk.terraSoft : st === 'warn' ? tk.claySoft : tk.appleSoft
  const statusLabel = (st: 'ok' | 'warn' | 'crit') => st === 'crit' ? 'CRÍT.' : st === 'warn' ? 'BAJO' : 'OK'

  return (
    <div style={{ padding: '32px 36px 60px' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.2em', color: tk.appleDeep, textTransform: 'uppercase', margin: '0 0 8px' }}>
          PRODUCTIVITY · VISIÓN GENERAL
        </p>
        <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 36, lineHeight: 1.0, letterSpacing: '-0.02em', margin: '0 0 6px', color: tk.iron }}>
          ¿Qué rendimiento te devuelve el equipo?
        </h1>
        <p style={{ fontFamily: ff.mono, fontSize: 12.5, color: tk.iron60, margin: 0 }}>
          SPLH, ventas por empleado, tickets/hora, prime cost. Detección de franjas muertas y coste de ineficiencia.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 0, border: `1.5px solid ${tk.iron}`, marginBottom: 20, width: 'fit-content' }}>
        {(['7', '30', 'mtd'] as const).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              padding: '7px 14px',
              background: range === r ? tk.iron : tk.paper,
              color: range === r ? tk.cream : tk.iron,
              border: 'none', cursor: 'pointer',
              fontFamily: ff.mono, fontSize: 11, letterSpacing: '0.06em',
              borderLeft: r !== '7' ? `1.5px solid ${tk.iron}` : 'none',
            }}
          >
            {r === '7' ? 'ÚLTIMA SEMANA' : r === '30' ? 'ÚLTIMOS 30D' : 'ESTE MES'}
          </button>
        ))}
      </div>

      {loading || !s ? (
        <div style={{ fontFamily: ff.mono, fontSize: 12, color: tk.iron60 }}>Cargando…</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: `1.5px solid ${tk.iron}`, marginBottom: 14 }}>
            <KpiCell label="SPLH" value={s.splh != null ? `€${fmtN(s.splh)}` : '—'} sub="ventas / hora trabajada" />
            <KpiCell label="VENTAS/EMPLEADO" value={s.ventas_por_empleado != null ? fmt(s.ventas_por_empleado) : '—'} sub="por turno" />
            <KpiCell label="TICKETS/HORA" value={s.tickets_por_hora != null ? fmtN(s.tickets_por_hora) : '—'} sub="ticket promedio" />
            <KpiCell label="PRODUCT. INDEX" value={s.productividad_index != null ? `${s.productividad_index}` : '—'} sub="vs target SPLH" variant={s.productividad_index != null && s.productividad_index < 60 ? 'crit' : s.productividad_index != null && s.productividad_index < 85 ? 'warn' : 'ok'} last />
          </div>

          {/* Prime cost + coste ineficiencia */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', border: `1.5px solid ${tk.iron}`, marginBottom: 20 }}>
            <KpiCell
              label="PRIME COST %"
              value={s.prime_cost_pct != null ? `${fmtN(s.prime_cost_pct)}%` : '—'}
              sub="(Food + Labor) / Ventas · ideal <60%"
              variant={s.prime_cost_pct != null && s.prime_cost_pct > 70 ? 'crit' : s.prime_cost_pct != null && s.prime_cost_pct > 60 ? 'warn' : 'ok'}
            />
            <KpiCell
              label="COSTE DE INEFICIENCIA"
              value={fmt(s.coste_ineficiencia)}
              sub="horas de más × coste/h (vs SPLH ideal)"
              variant={s.coste_ineficiencia > 200 ? 'crit' : s.coste_ineficiencia > 50 ? 'warn' : 'default'}
              last
            />
          </div>

          {/* Por franja */}
          <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}` }}>
            <div style={{ padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.iron, textTransform: 'uppercase' }}>
              SPLH por franja vs target
            </div>
            {s.por_franja.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', fontFamily: ff.mono, fontSize: 11, color: tk.iron40, letterSpacing: '0.06em' }}>
                SIN DATOS · IMPORTA TURNOS Y VENTAS POR FRANJA
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontFamily: ff.mono, fontSize: 11.5 }}>
                <thead><tr>
                  <th style={thStyle}>Franja</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Ventas</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Horas</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>SPLH real</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>SPLH target</th>
                  <th style={thStyle}>Estado</th>
                </tr></thead>
                <tbody>
                  {s.por_franja.map((f, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${tk.iron20}`, background: statusBg(f.status) }}>
                      <td style={tdStyle}><strong>{f.slot}</strong></td>
                      <td style={{ ...tdStyle, textAlign: 'right' as const }}>{fmt(f.ventas)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' as const }}>{fmtN(f.horas)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' as const, color: statusColor(f.status), fontWeight: 600 }}>{f.splh != null ? `€${fmtN(f.splh)}` : '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' as const, color: tk.iron60 }}>{f.target_splh != null ? `€${fmtN(f.target_splh)}` : '—'}</td>
                      <td style={tdStyle}>
                        <span style={{
                          fontFamily: ff.mono, fontSize: 9, letterSpacing: '0.14em',
                          textTransform: 'uppercase' as const, padding: '3px 7px',
                          border: `1px solid ${statusColor(f.status)}`, color: statusColor(f.status), background: tk.paper,
                        }}>{statusLabel(f.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function KpiCell({ label, value, sub, variant = 'default', last }: { label: string; value: string; sub: string; variant?: 'default' | 'warn' | 'crit' | 'ok'; last?: boolean }) {
  const valueColor = variant === 'crit' ? tk.terra : variant === 'warn' ? tk.clay : variant === 'ok' ? tk.appleDeep : tk.iron
  return (
    <div style={{ padding: '18px 22px', borderRight: last ? 'none' : `1.5px solid ${tk.iron20}`, background: tk.paper }}>
      <div style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.15em', color: tk.iron40, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 32, lineHeight: 1, color: valueColor, margin: '6px 0 4px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60 }}>{sub}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '8px 14px', textAlign: 'left' as const, fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase' as const, fontWeight: 400, background: tk.creamSoft, borderBottom: `1px solid ${tk.iron20}` }
const tdStyle: React.CSSProperties = { padding: '8px 14px', color: tk.iron, fontVariantNumeric: 'tabular-nums' as const }
