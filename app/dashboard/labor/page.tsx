'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { tk, ff } from '@/lib/design'

interface LaborSummary {
  horas_plan: number
  horas_real: number
  coste_total: number
  coste_medio_hora: number
  ventas_netas: number
  labor_pct: number | null
  splh: number | null
  por_rol: { rol: string; horas: number; coste: number; pct: number }[]
  por_servicio: { servicio: string; horas: number; coste: number; ventas: number; labor_pct: number | null }[]
  por_centro: { site_id: string; horas: number; coste: number; ventas: number; labor_pct: number | null }[]
  por_dia: { fecha: string; horas: number; coste: number; ventas: number; labor_pct: number | null; splh: number | null }[]
}

const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
const fmtN = (v: number, d = 1) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v)

export default function LaborOverviewPage() {
  const [data, setData] = useState<{ summary: LaborSummary; dq: any; from: string; to: string } | null>(null)
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
    fetch(`/api/labor/summary?from=${fromStr}&to=${toStr}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [range])

  const s = data?.summary
  const dqParcial = data?.dq?.data_quality === 'PARCIAL'

  return (
    <div style={{ padding: '32px 36px 60px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.2em', color: tk.appleDeep, textTransform: 'uppercase', margin: '0 0 8px' }}>
          LABOR COST · VISIÓN GENERAL
        </p>
        <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 36, lineHeight: 1.0, letterSpacing: '-0.02em', margin: '0 0 6px', color: tk.iron }}>
          ¿Cuánto te cuesta hoy el equipo?
        </h1>
        <p style={{ fontFamily: ff.mono, fontSize: 12.5, color: tk.iron60, margin: 0 }}>
          Coste laboral, horas planificadas y reales, distribución por rol/servicio/centro.
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 0, border: `1.5px solid ${tk.iron}` }}>
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
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/dashboard/labor/empleados" style={btnGhost}>Empleados</Link>
          <Link href="/dashboard/labor/turnos" style={btnGhost}>Horarios</Link>
          <Link href="/dashboard/labor/turno-ideal" style={btnPrimary}>Turno ideal →</Link>
        </div>
      </div>

      {dqParcial && (
        <div style={{
          background: tk.claySoft, border: `1.5px solid ${tk.clay}`,
          padding: '10px 14px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ width: 6, height: 6, background: tk.clay, flexShrink: 0 }} />
          <p style={{ fontFamily: ff.mono, fontSize: 11, color: tk.clay, margin: 0, letterSpacing: '0.04em' }}>
            <strong>DATA PARCIAL</strong> · faltan turnos o ventas por franja en el periodo seleccionado. Los KPIs pueden estar incompletos.
          </p>
        </div>
      )}

      {loading || !s ? (
        <div style={{ fontFamily: ff.mono, fontSize: 12, color: tk.iron60 }}>Cargando…</div>
      ) : (
        <>
          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: `1.5px solid ${tk.iron}`, marginBottom: 20 }}>
            <KpiCell label="LABOR COST" value={fmt(s.coste_total)} sub={`${fmtN(s.horas_plan)} horas plan`} />
            <KpiCell label="LABOR %" value={s.labor_pct != null ? `${fmtN(s.labor_pct)}%` : '—'} sub={`vs target 22%`} variant={s.labor_pct != null && s.labor_pct > 30 ? 'crit' : s.labor_pct != null && s.labor_pct > 25 ? 'warn' : 'default'} />
            <KpiCell label="SPLH" value={s.splh != null ? `€${fmtN(s.splh)}` : '—'} sub={`ventas/hora`} />
            <KpiCell label="COSTE MEDIO/H" value={fmt(s.coste_medio_hora)} sub={`media ponderada`} last />
          </div>

          {/* Grid: por rol / por servicio */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <Panel title="Coste por rol">
              {s.por_rol.length === 0 ? <Empty /> : (
                <table style={tblStyle}>
                  <thead><tr>
                    <Th>Rol</Th><Th align="right">Horas</Th><Th align="right">Coste</Th><Th align="right">%</Th>
                  </tr></thead>
                  <tbody>
                    {s.por_rol.map((r, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                        <Td>{r.rol}</Td>
                        <Td align="right">{fmtN(r.horas)}</Td>
                        <Td align="right">{fmt(r.coste)}</Td>
                        <Td align="right">{fmtN(r.pct)}%</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel title="Coste por servicio">
              {s.por_servicio.length === 0 ? <Empty /> : (
                <table style={tblStyle}>
                  <thead><tr>
                    <Th>Servicio</Th><Th align="right">Horas</Th><Th align="right">Coste</Th><Th align="right">Labor%</Th>
                  </tr></thead>
                  <tbody>
                    {s.por_servicio.map((r, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                        <Td>{r.servicio}</Td>
                        <Td align="right">{fmtN(r.horas)}</Td>
                        <Td align="right">{fmt(r.coste)}</Td>
                        <Td align="right" color={r.labor_pct != null && r.labor_pct > 30 ? tk.terra : r.labor_pct != null && r.labor_pct > 25 ? tk.clay : tk.iron}>
                          {r.labor_pct != null ? `${fmtN(r.labor_pct)}%` : '—'}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          {/* Evolución por día */}
          <Panel title="Evolución por día">
            {s.por_dia.length === 0 ? <Empty /> : (
              <table style={tblStyle}>
                <thead><tr>
                  <Th>Fecha</Th>
                  <Th align="right">Horas</Th>
                  <Th align="right">Coste</Th>
                  <Th align="right">Ventas</Th>
                  <Th align="right">Labor %</Th>
                  <Th align="right">SPLH</Th>
                </tr></thead>
                <tbody>
                  {s.por_dia.map((r, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                      <Td>{r.fecha}</Td>
                      <Td align="right">{fmtN(r.horas)}</Td>
                      <Td align="right">{fmt(r.coste)}</Td>
                      <Td align="right">{r.ventas > 0 ? fmt(r.ventas) : '—'}</Td>
                      <Td align="right" color={r.labor_pct != null && r.labor_pct > 30 ? tk.terra : r.labor_pct != null && r.labor_pct > 25 ? tk.clay : tk.iron}>
                        {r.labor_pct != null ? `${fmtN(r.labor_pct)}%` : '—'}
                      </Td>
                      <Td align="right">{r.splh != null ? `€${fmtN(r.splh)}` : '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}

function KpiCell({ label, value, sub, variant = 'default', last }: { label: string; value: string; sub: string; variant?: 'default' | 'warn' | 'crit'; last?: boolean }) {
  const valueColor = variant === 'crit' ? tk.terra : variant === 'warn' ? tk.clay : tk.iron
  return (
    <div style={{ padding: '18px 22px', borderRight: last ? 'none' : `1.5px solid ${tk.iron20}`, background: tk.paper }}>
      <div style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.15em', color: tk.iron40, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 32, lineHeight: 1, color: valueColor, margin: '6px 0 4px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60 }}>{sub}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}` }}>
      <div style={{ padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.iron, textTransform: 'uppercase' }}>{title}</div>
      <div style={{ padding: 0 }}>{children}</div>
    </div>
  )
}

function Empty() {
  return (
    <div style={{ padding: '30px 16px', textAlign: 'center', fontFamily: ff.mono, fontSize: 11, color: tk.iron40, letterSpacing: '0.06em' }}>
      SIN DATOS · IMPORTA TURNOS PARA EMPEZAR
    </div>
  )
}

const tblStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontFamily: ff.mono, fontSize: 11.5 }

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th style={{ padding: '8px 14px', textAlign: align, fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase', fontWeight: 400, background: tk.creamSoft }}>{children}</th>
}
function Td({ children, align = 'left', color }: { children: React.ReactNode; align?: 'left' | 'right'; color?: string }) {
  return <td style={{ padding: '8px 14px', textAlign: align, color: color || tk.iron, fontVariantNumeric: 'tabular-nums' }}>{children}</td>
}

const btnPrimary: React.CSSProperties = { padding: '7px 14px', background: tk.apple, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: tk.iron, letterSpacing: '0.06em', textDecoration: 'none' }
const btnGhost: React.CSSProperties = { padding: '7px 14px', background: tk.paper, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: tk.iron, letterSpacing: '0.06em', textDecoration: 'none' }
