'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { eur, hoyIso, num } from '@/lib/format'
import { Btn, Field, Input, Note, Page, Panel, Select, Stat, Table, Td, Tr } from '@/components/ui'

const SLOTS = ['09:00–11:00', '11:00–13:00', '13:00–15:00', '15:00–17:00', '17:00–19:00', '19:00–21:00', '21:00–23:00']
const SAMPLE: Record<string, number> = { '09:00–11:00': 250, '11:00–13:00': 480, '13:00–15:00': 2100, '15:00–17:00': 720, '17:00–19:00': 380, '19:00–21:00': 1850, '21:00–23:00': 1620 }
const service = (hm: string) => { const [h, m] = hm.split(':').map(Number); const t = h * 60 + m; return t < 660 ? 'Desayuno' : t < 960 ? 'Comida' : t < 1140 ? 'Entre servicios' : 'Cena' }

export default function TurnoIdealPage() {
  const [date, setDate] = useState(hoyIso()), [locations, setLocations] = useState<any[]>([]), [locationId, setLocationId] = useState('')
  const [target, setTarget] = useState('65'), [avgCost, setAvgCost] = useState('')
  const [forecast, setForecast] = useState<Record<string, string>>(Object.fromEntries(SLOTS.map(s => [s, ''])))
  const [plan, setPlan] = useState<Record<string, string>>(Object.fromEntries(SLOTS.map(s => [s, ''])))
  const [usePlanFromShifts, setUsePlanFromShifts] = useState(true)
  const [res, setRes] = useState<any>(null), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  useEffect(() => { api.get('/api/locations').then(r => setLocations(r.data)).catch(() => {}); api.get('/api/labor/targets').then(r => { const t = r.data.find((x: any) => !x.role && (!x.service || x.service === 'All day') && x.target_splh); if (t) setTarget(String(t.target_splh)) }).catch(() => {}) }, [])

  async function calc() {
    setBusy(true); setErr('')
    try {
      const body: any = { date, locationId: locationId ? Number(locationId) : null, targetSplh: Number(target), avgHourlyCost: avgCost ? Number(avgCost) : null, forecast: SLOTS.filter(s => Number(forecast[s]) > 0).map(s => ({ slot: s, ventas: Number(forecast[s]) })) }
      if (!usePlanFromShifts) body.plan = SLOTS.map(s => ({ slot: s, horas: Number(plan[s]) || 0 }))
      if (!body.forecast.length) throw new Error('Introduce ventas previstas en al menos una franja')
      setRes(await api.post('/api/labor/ideal-shift', body))
    } catch (e) { setErr(errorMessage(e)) }
    setBusy(false)
  }
  const color = (s: string) => s === 'sobredotacion' ? tk.terra : s === 'subdotacion' ? tk.clay : tk.appleDeep
  const bg = (s: string) => s === 'sobredotacion' ? tk.terraSoft : s === 'subdotacion' ? tk.claySoft : tk.appleSoft

  return (
    <Page eyebrow="Labor cost · Turno ideal" title="¿Cuántas horas necesitas hoy?" subtitle="Forecast de ventas por franja + objetivo de ventas por hora → horas y coste ideales, y aviso de sobre o subdotación frente a lo planificado.">
      <Panel><div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <Field label="Fecha"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Centro"><Select value={locationId} onChange={e => setLocationId(e.target.value)}><option value="">Todos</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="Objetivo ventas/hora (SPLH €)"><Input type="number" step="1" min={1} value={target} onChange={e => setTarget(e.target.value)} /></Field>
        <Field label="Coste medio €/h" hint="Vacío = media de los empleados activos"><Input type="number" step="0.5" min={0} value={avgCost} onChange={e => setAvgCost(e.target.value)} /></Field>
      </div></Panel>
      <Panel title="Ventas previstas y horas planificadas por franja" right={<span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><label style={{ fontFamily: ff.mono, fontSize: 10.5, display: 'flex', gap: 5, alignItems: 'center', textTransform: 'none', letterSpacing: 0, cursor: 'pointer' }}><input type="checkbox" checked={usePlanFromShifts} onChange={e => setUsePlanFromShifts(e.target.checked)} /> horas plan desde los turnos del día</label><Btn small kind="ghost" onClick={() => setForecast(Object.fromEntries(SLOTS.map(s => [s, String(SAMPLE[s])])))}>EJEMPLO</Btn></span>}>
        <Table head={['Franja', 'Servicio', 'Ventas previstas €', 'Horas planificadas']} right={[2, 3]}>
          {SLOTS.map(s => <Tr key={s}><Td><strong>{s}</strong></Td><Td style={{ color: tk.iron60 }}>{service(s.split('–')[0])}</Td><Td right><Input type="number" step="50" min={0} value={forecast[s]} onChange={e => setForecast(f => ({ ...f, [s]: e.target.value }))} style={{ width: 120, textAlign: 'right', padding: '5px 8px' }} /></Td><Td right><Input type="number" step="0.5" min={0} disabled={usePlanFromShifts} value={usePlanFromShifts ? '' : plan[s]} placeholder={usePlanFromShifts ? 'turnos' : ''} onChange={e => setPlan(p => ({ ...p, [s]: e.target.value }))} style={{ width: 120, textAlign: 'right', padding: '5px 8px', opacity: usePlanFromShifts ? 0.5 : 1 }} /></Td></Tr>)}
        </Table>
        <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end' }}><Btn onClick={calc} disabled={busy}>{busy ? 'CALCULANDO…' : 'CALCULAR TURNO IDEAL →'}</Btn></div>
      </Panel>
      {err && <Note tone="crit">{err}</Note>}
      {res && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
            <Stat label="Horas ideales" value={num(res.totales.horas_ideales, 1)} sub={`vs ${num(res.totales.horas_plan, 1)} h plan`} />
            <Stat label="Coste ideal" value={eur(res.totales.coste_ideal)} sub={`vs ${eur(res.totales.coste_plan)} plan · ${eur(res.avgHourlyCost)}/h`} />
            <Stat label="Δ horas" value={`${res.totales.delta_horas > 0 ? '+' : ''}${num(res.totales.delta_horas, 1)} h`} sub={res.totales.delta_horas > 0 ? 'exceso' : res.totales.delta_horas < 0 ? 'falta' : 'óptimo'} tone={res.totales.delta_horas > 1 ? 'crit' : res.totales.delta_horas < -0.5 ? 'warn' : 'ok'} />
            <Stat label="Δ coste" value={`${res.totales.delta_coste > 0 ? '+' : ''}${eur(res.totales.delta_coste)}`} sub={res.totales.delta_coste > 0 ? 'ahorrable' : 'a reforzar'} tone={Math.abs(res.totales.delta_coste) > 50 ? 'crit' : undefined} />
          </div>
          <Panel title="Plan vs ideal por franja">
            <Table head={['Franja', 'Servicio', 'Ventas', 'H ideal', 'H plan', 'Δ h', 'Δ €', 'Estado']} right={[2, 3, 4, 5, 6]}>
              {res.slots.map((s: any) => <tr key={s.slot} style={{ borderTop: `1px solid ${tk.iron20}`, background: bg(s.status) }}><Td><strong>{s.slot}</strong></Td><Td style={{ color: tk.iron60 }}>{s.servicio}</Td><Td right>{eur(s.ventas_previstas)}</Td><Td right style={{ fontWeight: 600 }}>{num(s.horas_ideales, 1)}</Td><Td right>{num(s.horas_plan, 1)}</Td><Td right style={{ color: color(s.status), fontWeight: 600 }}>{s.delta_horas > 0 ? '+' : ''}{num(s.delta_horas, 1)}</Td><Td right style={{ color: color(s.status) }}>{s.delta_coste > 0 ? '+' : ''}{eur(s.delta_coste)}</Td><Td><span style={{ fontFamily: ff.mono, fontSize: 9, letterSpacing: '0.14em', padding: '3px 7px', border: `1px solid ${color(s.status)}`, color: color(s.status), background: tk.paper }}>{s.status === 'sobredotacion' ? 'SOBREDOT.' : s.status === 'subdotacion' ? 'SUBDOT.' : 'OK'}</span></Td></tr>)}
            </Table>
          </Panel>
          <Panel title="Recomendaciones"><div style={{ padding: 16 }}>{res.alertas.length === 0 ? <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.appleDeep, margin: 0 }}>✓ Plantilla óptima · no hay franjas sobre o subdotadas.</p> : <ul style={{ margin: 0, paddingLeft: 16, fontFamily: ff.mono, fontSize: 12, lineHeight: 1.7 }}>{res.alertas.map((a: any, i: number) => <li key={i}><span style={{ color: color(a.status), fontWeight: 600 }}>{a.slot}</span> · {a.recomendacion}</li>)}</ul>}</div></Panel>
        </>
      )}
    </Page>
  )
}
