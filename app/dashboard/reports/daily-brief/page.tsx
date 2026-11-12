'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { eur, fecha, hoyIso, num, pct } from '@/lib/format'
import { Btn, Loading, Note, Page, Panel, Select } from '@/components/ui'

export default function DailyBriefPage() {
  const [scope, setScope] = useState<'group' | 'location'>('group')
  const [locations, setLocations] = useState<any[]>([]), [locationId, setLocationId] = useState('')
  const [date, setDate] = useState(hoyIso())
  const [b, setB] = useState<any>(null), [loading, setLoading] = useState(true), [err, setErr] = useState('')
  useEffect(() => { api.get('/api/locations').then(r => { setLocations(r.data); if (r.data[0]) setLocationId(String(r.data[0].id)) }).catch(() => {}) }, [])
  const load = useCallback(async () => {
    if (scope === 'location' && !locationId) return
    setLoading(true); setErr('')
    try { setB(await api.get(`/api/reports/daily-brief?scope=${scope}&date=${date}${scope === 'location' ? `&locationId=${locationId}` : ''}`)) } catch (e) { setErr(errorMessage(e)) }
    setLoading(false)
  }, [scope, locationId, date])
  useEffect(() => { load() }, [load])

  const subject = b ? `[Marginbite] Daily brief · ${scope === 'group' ? 'Grupo' : locations.find(l => String(l.id) === locationId)?.name ?? 'Local'} · ${fecha(b.date)} | Ventas ${eur(b.kpis.ventas.ayer)} | FC ${pct(b.kpis.food_cost.pct, 0)} | LC ${pct(b.kpis.labor.pct, 0)}` : ''
  const urgencyColor = (u: string) => u === 'crit' ? tk.terra : u === 'warn' ? tk.clay : tk.appleDeep

  return (
    <Page eyebrow="Reports · Daily ops brief" title="El día en una página" subtitle="Ventas de ayer, food cost, labor, productividad, merma y caja, con las prioridades reales del día. Se guarda un registro por fecha y ámbito."
      actions={<>
        <div style={{ display: 'flex', border: `1.5px solid ${tk.iron}` }}>{(['group', 'location'] as const).map(s => <button key={s} onClick={() => setScope(s)} style={{ padding: '7px 14px', background: scope === s ? tk.iron : tk.paper, color: scope === s ? tk.cream : tk.iron, border: 'none', cursor: 'pointer', fontFamily: ff.mono, fontSize: 11, letterSpacing: '0.06em' }}>{s === 'group' ? 'GRUPO' : 'LOCAL'}</button>)}</div>
        {scope === 'location' && (locations.length ? <Select value={locationId} onChange={e => setLocationId(e.target.value)} style={{ width: 180 }}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select> : <span style={{ fontFamily: ff.mono, fontSize: 11, color: tk.clay }}>Sin centros: crea uno en Labor</span>)}
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '7px 10px', border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, background: tk.paper }} />
        <Btn kind="ghost" onClick={load}>REGENERAR</Btn>
      </>}>
      {err && <Note tone="crit">{err}</Note>}
      {loading || !b ? <Loading /> : (
        <>
          {b.data_quality === 'PARCIAL' && (
            <Note tone="warn"><strong>DATOS PARCIALES</strong> · faltan {b.missing.length} fuente{b.missing.length !== 1 ? 's' : ''}; algunos KPIs aparecen como —.
              <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>{b.missing.map((m: any, i: number) => <li key={i}><strong>{m.dato}</strong>: {m.detalle} · <Link href={m.link} style={{ color: tk.clay }}>cargar →</Link></li>)}</ul>
            </Note>
          )}
          <div style={{ background: tk.iron, color: tk.cream, padding: '18px 24px', marginBottom: 16 }}>
            <div style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.apple, textTransform: 'uppercase' }}>Daily ops brief · {scope === 'group' ? 'grupo' : locations.find(l => String(l.id) === locationId)?.name} · {fecha(b.date)}</div>
            <div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 18, margin: '6px 0 2px' }}>{subject.replace('[Marginbite] ', '')}</div>
            <div style={{ fontFamily: ff.mono, fontSize: 10.5, opacity: 0.55 }}>{b.alertas.length} alertas · {b.prioridades.length} prioridades · generado {new Date(b.generado).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
            <Kpi label="Ventas · ayer" value={eur(b.kpis.ventas.ayer)} sub={`hoy previsto ${eur(b.kpis.ventas.hoy_forecast)}`} href="/dashboard/labor/turnos" />
            <Kpi label="Food cost · 7 días" value={pct(b.kpis.food_cost.pct, 0)} sub={`${eur(b.kpis.food_cost.gasto_7d)} compras / ${eur(b.kpis.food_cost.ventas_7d)} ventas`} tone={b.kpis.food_cost.pct > 33 ? 'crit' : undefined} href="/dashboard/compras/facturas" />
            <Kpi label="Labor cost · ayer" value={pct(b.kpis.labor.pct, 1)} sub={`${eur(b.kpis.labor.coste)} · ${num(b.kpis.labor.horas_plan, 1)} h plan`} tone={b.kpis.labor.pct > 30 ? 'crit' : b.kpis.labor.pct > 25 ? 'warn' : undefined} href="/dashboard/labor" />
            <Kpi label="Productividad" value={b.kpis.productivity.splh != null ? `${eur(b.kpis.productivity.splh)}/h` : '—'} sub={b.kpis.productivity.coste_ineficiencia != null ? `ineficiencia ${eur(b.kpis.productivity.coste_ineficiencia)}` : 'SPLH'} href="/dashboard/productivity" />
            <Kpi label="Merma · ayer" value={eur(b.kpis.merma.total)} sub={b.kpis.merma.eventos ? `${b.kpis.merma.eventos} eventos · ${b.kpis.merma.top.slice(0, 2).map((t: any) => t.description).join(', ')}` : 'sin registros'} tone={b.kpis.merma.total > 50 ? 'warn' : undefined} href="/dashboard/merma" />
            <Kpi label="Caja · pagos" value={b.kpis.cash.vencidas.n > 0 ? `${b.kpis.cash.vencidas.n} vencidas` : 'OK'} sub={b.kpis.cash.vencidas.n > 0 ? `${eur(b.kpis.cash.vencidas.total)} · ${b.kpis.cash.proximas_7d.n} vencen en 7d` : `${b.kpis.cash.proximas_7d.n} vencen en 7 días (${eur(b.kpis.cash.proximas_7d.total)})`} tone={b.kpis.cash.vencidas.n > 0 ? 'crit' : undefined} href="/dashboard/compras/facturas" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            <Panel title={`Top ${b.alertas.length} alerta${b.alertas.length !== 1 ? 's' : ''}`}>
              {b.alertas.length === 0 ? <div style={{ padding: 20, fontFamily: ff.mono, fontSize: 12, color: tk.appleDeep }}>✓ Sin alertas para hoy.</div> : b.alertas.map((a: any, i: number) => (
                <Link key={i} href={a.link} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${tk.iron20}` : 'none', textDecoration: 'none', alignItems: 'center' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: urgencyColor(a.urgencia), flexShrink: 0 }} />
                  <div style={{ flex: 1 }}><div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 13, color: tk.iron }}>{a.titulo}</div><div style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60 }}>{a.impacto}</div></div>
                  <span style={{ fontFamily: ff.mono, fontSize: 10, color: urgencyColor(a.urgencia) }}>→</span>
                </Link>
              ))}
            </Panel>
            <Panel title="Prioridades del día">
              {b.prioridades.length === 0 ? <div style={{ padding: 20, fontFamily: ff.mono, fontSize: 12, color: tk.appleDeep }}>✓ No hay acciones pendientes.</div> : <ol style={{ margin: 0, padding: '14px 16px 14px 34px', fontFamily: ff.mono, fontSize: 12.5, lineHeight: 1.8 }}>{b.prioridades.map((p: string, i: number) => <li key={i}>{p}</li>)}</ol>}
            </Panel>
          </div>
        </>
      )}
    </Page>
  )
}

function Kpi({ label, value, sub, tone, href }: { label: string; value: string; sub?: string; tone?: 'warn' | 'crit'; href: string }) {
  const color = tone === 'crit' ? tk.terra : tone === 'warn' ? tk.clay : tk.iron
  return (
    <Link href={href} style={{ textDecoration: 'none', padding: '14px 18px', background: tk.paper, border: `1.5px solid ${tk.iron}` }}>
      <div style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: tk.iron40 }}>{label}</div>
      <div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 24, color, margin: '4px 0 2px' }}>{value}</div>
      {sub && <div style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.iron60 }}>{sub}</div>}
    </Link>
  )
}
