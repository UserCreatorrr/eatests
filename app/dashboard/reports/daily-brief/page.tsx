'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { tk, ff } from '@/lib/design'

interface Brief {
  scope: 'grupo' | 'local'
  site_id: string | null
  fecha: string
  generado: string
  data_quality: 'OK' | 'PARCIAL'
  missing?: { dato: string; detalle: string; link: string }[]
  kpis: {
    ventas: { ayer: number; hoy_forecast: number }
    food_cost: { pct: number | null; gasto_7d: number; ventas_7d: number }
    labor: { pct: number | null; coste: number; horas_plan: number }
    productivity: { splh: number | null; productividad_index: number | null; coste_ineficiencia: number; tickets_por_hora: number | null }
    merma: { total: number; eventos: number; top: { nombre: string; t: number }[] }
    cash: { vencidas: { c: number; t: number }; proximas_7d: { c: number; t: number } }
  }
  alertas: { titulo: string; impacto: string; link: string; urgencia: 'crit' | 'warn' | 'info' }[]
  prioridades: string[]
}

const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
const fmtN = (v: number, d = 1) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v)

export default function DailyBriefPage() {
  const [scope, setScope] = useState<'grupo' | 'local'>('grupo')
  const [siteId, setSiteId] = useState('')
  const [sites, setSites] = useState<string[]>([])
  const [brief, setBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(true)

  // Carga la lista de centros para el selector de Scope Local
  useEffect(() => {
    fetch('/api/sites').then(r => r.json()).then(d => {
      const list: string[] = d.sites || []
      setSites(list)
      if (!siteId && list.length > 0) setSiteId(list[0])
    }).catch(() => {})
  }, [])

  function fetchBrief() {
    setLoading(true)
    const url = `/api/reports/daily-brief?scope=${scope}${scope === 'local' && siteId ? `&site=${encodeURIComponent(siteId)}` : ''}`
    fetch(url).then(r => r.json()).then(setBrief).finally(() => setLoading(false))
  }

  useEffect(() => { fetchBrief() }, [scope, siteId])

  if (loading || !brief) return <div style={{ padding: 36, fontFamily: ff.mono, color: tk.iron60 }}>Cargando…</div>

  const subject = `[Marginbite] Daily Brief — ${scope === 'grupo' ? 'Grupo' : siteId || 'Local'} — ${brief.fecha} | Ventas: ${fmt(brief.kpis.ventas.ayer)} | FC: ${brief.kpis.food_cost.pct ?? '—'}% | LC: ${brief.kpis.labor.pct ?? '—'}% | SPLH: ${brief.kpis.productivity.splh ? '€' + fmtN(brief.kpis.productivity.splh) : '—'}`

  const urgenciaColor = (u: 'crit' | 'warn' | 'info') => u === 'crit' ? tk.terra : u === 'warn' ? tk.clay : tk.iron60
  const urgenciaBg = (u: 'crit' | 'warn' | 'info') => u === 'crit' ? tk.terraSoft : u === 'warn' ? tk.claySoft : tk.creamSoft

  return (
    <div style={{ padding: '32px 36px 60px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.2em', color: tk.appleDeep, textTransform: 'uppercase', margin: '0 0 8px' }}>
          REPORTS · DAILY OPS BRIEF
        </p>
        <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 36, lineHeight: 1.0, letterSpacing: '-0.02em', margin: '0 0 6px', color: tk.iron }}>
          El brief que tu COO lee en 90 segundos.
        </h1>
        <p style={{ fontFamily: ff.mono, fontSize: 12.5, color: tk.iron60, margin: 0 }}>
          Templated email con KPI strip, top 5 alertas y 3 prioridades del día. Programable diariamente.
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', border: `1.5px solid ${tk.iron}` }}>
          {(['grupo', 'local'] as const).map(s => (
            <button key={s} onClick={() => setScope(s)} style={{
              padding: '7px 14px', background: scope === s ? tk.iron : tk.paper, color: scope === s ? tk.cream : tk.iron,
              border: 'none', cursor: 'pointer', fontFamily: ff.mono, fontSize: 11, letterSpacing: '0.08em',
              textTransform: 'uppercase' as const, borderLeft: s === 'local' ? `1.5px solid ${tk.iron}` : 'none',
            }}>SCOPE {s.toUpperCase()}</button>
          ))}
        </div>
        {scope === 'local' && (
          sites.length > 0 ? (
            <select value={siteId} onChange={e => setSiteId(e.target.value)}
              style={{ padding: '7px 12px', fontFamily: ff.mono, fontSize: 11.5, border: `1.5px solid ${tk.iron}`, background: tk.paper, color: tk.iron, outline: 'none', cursor: 'pointer' }}>
              {sites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <span style={{ padding: '7px 12px', fontFamily: ff.mono, fontSize: 11, color: tk.iron60, border: `1.5px dashed ${tk.iron20}` }}>
              Sin centros — carga turnos o ventas con site_id
            </span>
          )
        )}
        <button onClick={fetchBrief} style={btnGhost}>Regenerar</button>
      </div>

      {/* DATA QUALITY banner */}
      {brief.data_quality === 'PARCIAL' && (
        <div style={{ background: tk.claySoft, border: `1.5px solid ${tk.clay}`, padding: '12px 14px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: brief.missing?.length ? 10 : 0 }}>
            <span style={{ width: 6, height: 6, background: tk.clay, flexShrink: 0 }} />
            <p style={{ fontFamily: ff.mono, fontSize: 11, color: tk.clay, margin: 0, letterSpacing: '0.04em' }}>
              <strong>DATA PARCIAL</strong> · {brief.missing?.length ? `falta${brief.missing.length !== 1 ? 'n' : ''} ${brief.missing.length} fuente${brief.missing.length !== 1 ? 's' : ''} de datos. Algunos KPIs aparecen como —.` : 'faltan datos para una vista completa.'}
            </p>
          </div>
          {brief.missing?.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0 8px 16px', borderTop: `1px solid ${tk.clay}30` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: ff.mono, fontSize: 11.5, fontWeight: 700, color: tk.iron }}>{m.dato}</div>
                <div style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.iron60, marginTop: 1 }}>{m.detalle}</div>
              </div>
              <Link href={m.link} style={{
                padding: '5px 11px', background: tk.paper, border: `1.5px solid ${tk.clay}`,
                fontFamily: ff.mono, fontSize: 10, fontWeight: 600, color: tk.clay, textDecoration: 'none',
                letterSpacing: '0.08em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
              }}>Cargar →</Link>
            </div>
          ))}
        </div>
      )}

      {/* EMAIL MOCKUP */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}` }}>
        {/* Email header */}
        <div style={{ background: tk.iron, color: tk.cream, padding: '18px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `linear-gradient(to right, rgba(223,213,201,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(223,213,201,0.06) 1px, transparent 1px)`,
            backgroundSize: '14px 14px' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.15em', color: tk.apple, margin: '0 0 6px', textTransform: 'uppercase' }}>SUBJECT</p>
            <p style={{ fontFamily: ff.mono, fontSize: 13, margin: 0, lineHeight: 1.4 }}>{subject}</p>
            <p style={{ fontFamily: ff.mono, fontSize: 10.5, opacity: 0.55, margin: '10px 0 0' }}>
              {brief.alertas.length} alertas · {brief.prioridades.length} prioridades · DQ {brief.data_quality}
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px' }}>
          {/* Header */}
          <div style={{ marginBottom: 22 }}>
            <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.18em', color: tk.iron40, textTransform: 'uppercase', margin: 0 }}>
              {brief.scope === 'grupo' ? 'SCOPE: GRUPO' : `SCOPE: ${brief.site_id || 'LOCAL'}`} · {brief.fecha}
            </p>
            <p style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 22, lineHeight: 1.1, margin: '6px 0 4px', letterSpacing: '-0.015em' }}>
              Brief del día — {new Date(brief.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
            <p style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, margin: 0 }}>
              Generado {new Date(brief.generado).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* KPI STRIP */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: `1.5px solid ${tk.iron}`, marginBottom: 22 }}>
            <KpiBox label="VENTAS · AYER" value={fmt(brief.kpis.ventas.ayer)} sub={`Hoy forecast ${fmt(brief.kpis.ventas.hoy_forecast)}`} href="/dashboard/ventas/albaranes" />
            <KpiBox label="FOOD COST" value={brief.kpis.food_cost.pct != null ? `${brief.kpis.food_cost.pct}%` : '—'} sub={`Últimos 7d · ${fmt(brief.kpis.food_cost.gasto_7d)}`} variant={brief.kpis.food_cost.pct != null && brief.kpis.food_cost.pct > 33 ? 'crit' : 'default'} href="/dashboard/sangrado" />
            <KpiBox label="LABOR COST" value={brief.kpis.labor.pct != null ? `${brief.kpis.labor.pct}%` : '—'} sub={`${fmt(brief.kpis.labor.coste)} · ${fmtN(brief.kpis.labor.horas_plan)}h plan`} variant={brief.kpis.labor.pct != null && brief.kpis.labor.pct > 30 ? 'crit' : brief.kpis.labor.pct != null && brief.kpis.labor.pct > 25 ? 'warn' : 'default'} href="/dashboard/labor" last />
            <KpiBox label="PRODUCTIVITY" value={brief.kpis.productivity.splh != null ? `€${fmtN(brief.kpis.productivity.splh)}` : '—'} sub={`SPLH${brief.kpis.productivity.tickets_por_hora ? ' · ' + fmtN(brief.kpis.productivity.tickets_por_hora) + ' tk/h' : ''}`} href="/dashboard/productivity" />
            <KpiBox label="MERMA · AYER" value={fmt(brief.kpis.merma.total)} sub={brief.kpis.merma.eventos > 0 ? `${brief.kpis.merma.eventos} eventos · ${brief.kpis.merma.top.slice(0,2).map(t => t.nombre).join(', ')}` : 'sin registros'} href="/dashboard/sangrado" />
            <KpiBox label="CASH · PAGOS" value={brief.kpis.cash.vencidas.c > 0 ? `${brief.kpis.cash.vencidas.c} vencidas` : 'OK'} sub={brief.kpis.cash.vencidas.c > 0 ? `${fmt(brief.kpis.cash.vencidas.t || 0)} · ${brief.kpis.cash.proximas_7d.c} próximas` : `${brief.kpis.cash.proximas_7d.c} en 7d`} variant={brief.kpis.cash.vencidas.c > 0 ? 'crit' : 'default'} href="/dashboard/compras/facturas" last />
          </div>

          {/* TOP 5 ALERTAS */}
          {brief.alertas.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.18em', color: tk.iron40, textTransform: 'uppercase', margin: '0 0 10px' }}>
                TOP {brief.alertas.length} ALERTA{brief.alertas.length !== 1 ? 'S' : ''}
              </p>
              {brief.alertas.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  background: urgenciaBg(a.urgencia), border: `1.5px solid ${urgenciaColor(a.urgencia)}30`,
                  marginBottom: 6,
                }}>
                  <span style={{ width: 4, height: 38, background: urgenciaColor(a.urgencia), flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 13, color: tk.iron }}>{a.titulo}</div>
                    <div style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, marginTop: 1 }}>{a.impacto}</div>
                  </div>
                  <Link href={a.link} style={{
                    padding: '5px 11px', background: tk.paper, border: `1.5px solid ${urgenciaColor(a.urgencia)}`,
                    fontFamily: ff.mono, fontSize: 10, fontWeight: 600,
                    color: urgenciaColor(a.urgencia), textDecoration: 'none',
                    letterSpacing: '0.08em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
                  }}>Resolver →</Link>
                </div>
              ))}
            </div>
          )}

          {/* 3 PRIORIDADES */}
          <div style={{ background: tk.iron, color: tk.cream, padding: '20px 22px' }}>
            <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.2em', color: tk.apple, textTransform: 'uppercase', margin: '0 0 12px' }}>
              HOY TOCA · 3 PRIORIDADES
            </p>
            <ol style={{ margin: 0, paddingLeft: 18, fontFamily: ff.mono, fontSize: 13, lineHeight: 1.7 }}>
              {brief.prioridades.map((p, i) => <li key={i}>{p}</li>)}
            </ol>
          </div>

          <p style={{ fontFamily: ff.mono, fontSize: 10, color: tk.iron40, textAlign: 'center', marginTop: 22, letterSpacing: '0.08em' }}>
            MARGINBITE · KITCHEN OS · DAILY OPS BRIEF
          </p>
        </div>
      </div>

      {/* Scheduler info */}
      <div style={{ marginTop: 28, padding: 18, background: tk.creamSoft, border: `1.5px solid ${tk.iron20}` }}>
        <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.iron40, textTransform: 'uppercase', margin: '0 0 6px' }}>
          PROGRAMACIÓN
        </p>
        <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.iron, margin: 0, lineHeight: 1.6 }}>
          Endpoint: <code style={{ background: tk.paper, padding: '2px 6px', border: `1px solid ${tk.iron20}` }}>GET /api/reports/daily-brief?scope=grupo</code>
          <br />
          Cadencia MVP: <strong>diaria 08:00</strong> (resumen ayer + forecast hoy). Recipients configurables en Reports · Recipients (próximamente).
          El envío real por email requiere configurar SMTP (Resend/SendGrid) en variables de entorno.
        </p>
      </div>
    </div>
  )
}

function KpiBox({ label, value, sub, variant = 'default', href, last }: { label: string; value: string; sub: string; variant?: 'default' | 'warn' | 'crit'; href: string; last?: boolean }) {
  const valueColor = variant === 'crit' ? tk.terra : variant === 'warn' ? tk.clay : tk.iron
  return (
    <Link href={href} style={{
      padding: '16px 20px',
      borderRight: last ? 'none' : `1.5px solid ${tk.iron20}`,
      borderBottom: `1px solid ${tk.iron20}`,
      background: tk.paper,
      textDecoration: 'none', display: 'block',
    }}>
      <div style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.15em', color: tk.iron40, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 24, lineHeight: 1, color: valueColor, margin: '5px 0 3px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em' }}>{value}</div>
      <div style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.iron60 }}>{sub}</div>
    </Link>
  )
}

const btnGhost: React.CSSProperties = { padding: '7px 14px', background: tk.paper, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: tk.iron, letterSpacing: '0.06em', cursor: 'pointer' }
