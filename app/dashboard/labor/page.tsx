'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { eur, fecha, num, pct } from '@/lib/format'
import EmptyState from '@/components/EmptyState'
import { Btn, Loading, Note, Page, Panel, Select, Stat, Table, Td, Tr } from '@/components/ui'
import { useRange } from '@/components/useRange'

export default function LaborOverviewPage() {
  const { range, picker } = useRange()
  const [locations, setLocations] = useState<any[]>([])
  const [locationId, setLocationId] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  useEffect(() => { api.get('/api/locations').then(r => setLocations(r.data)).catch(() => {}) }, [])
  useEffect(() => {
    if (!range) return
    setLoading(true)
    api.get(`/api/labor/summary?from=${range.from}&to=${range.to}${locationId ? `&locationId=${locationId}` : ''}`).then(setData).catch(e => setErr(errorMessage(e))).finally(() => setLoading(false))
  }, [range?.from, range?.to, locationId]) // eslint-disable-line react-hooks/exhaustive-deps

  const s = data?.summary
  const tone = (p: number | null) => p == null ? undefined : p > 30 ? 'crit' : p > 25 ? 'warn' : 'ok'

  return (
    <Page eyebrow="Labor cost · Visión general" title="¿Cuánto te cuesta hoy el equipo?" subtitle="Coste laboral, horas planificadas y reales, distribución por rol, servicio y día."
      actions={<><Btn kind="ghost" href="/dashboard/labor/empleados">EMPLEADOS</Btn><Btn kind="ghost" href="/dashboard/labor/turnos">HORARIOS</Btn><Btn href="/dashboard/labor/turno-ideal">TURNO IDEAL →</Btn></>}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>{picker}{locations.length > 0 && <Select value={locationId} onChange={e => setLocationId(e.target.value)} style={{ width: 200 }}><option value="">Todos los centros</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>}</div>
      {err && <Note tone="crit">{err}</Note>}
      {data?.dq?.data_quality === 'PARCIAL' && <Note tone="warn"><strong>DATOS PARCIALES</strong> · faltan {!data.dq.has_shifts ? 'turnos' : ''}{!data.dq.has_shifts && !data.dq.has_sales ? ' y ' : ''}{!data.dq.has_sales ? 'ventas por franja' : ''} en el periodo{data.dq.has_shifts && !data.dq.has_hourly_cost ? ' · hay turnos sin coste/hora' : ''}. Los KPIs pueden estar incompletos.</Note>}
      {loading || !s ? <Loading /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
            <Stat label="Labor cost" value={eur(s.coste_total)} sub={`${num(s.horas_plan, 1)} h plan · ${num(s.horas_real, 1)} h real`} />
            <Stat label="Labor %" value={pct(s.labor_pct)} sub="coste / ventas netas · objetivo ≤ 25%" tone={tone(s.labor_pct)} />
            <Stat label="SPLH" value={s.splh != null ? `${eur(s.splh)}/h` : '—'} sub="ventas por hora planificada" />
            <Stat label="Coste medio / h" value={eur(s.coste_medio_hora)} sub="media ponderada" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            <Panel title="Coste por rol">{s.por_rol.length === 0 ? <EmptyLabor /> : <Table head={['Rol', 'Horas', 'Coste', '%']} right={[1, 2, 3]}>{s.por_rol.map((r: any, i: number) => <Tr key={i}><Td>{r.rol}</Td><Td right>{num(r.horas, 1)}</Td><Td right>{eur(r.coste)}</Td><Td right>{pct(r.pct)}</Td></Tr>)}</Table>}</Panel>
            <Panel title="Coste por servicio">{s.por_servicio.length === 0 ? <EmptyLabor /> : <Table head={['Servicio', 'Horas', 'Coste', 'Ventas', 'Labor %']} right={[1, 2, 3, 4]}>{s.por_servicio.map((r: any, i: number) => <Tr key={i}><Td>{r.servicio}</Td><Td right>{num(r.horas, 1)}</Td><Td right>{eur(r.coste)}</Td><Td right>{r.ventas ? eur(r.ventas) : '—'}</Td><Td right style={{ color: r.labor_pct > 30 ? tk.terra : r.labor_pct > 25 ? tk.clay : tk.iron }}>{pct(r.labor_pct)}</Td></Tr>)}</Table>}</Panel>
          </div>
          <Panel title="Evolución por día">{s.por_dia.length === 0 ? <EmptyLabor /> : <Table head={['Fecha', 'Horas', 'Coste', 'Ventas', 'Labor %', 'SPLH']} right={[1, 2, 3, 4, 5]}>{s.por_dia.map((r: any, i: number) => <Tr key={i}><Td>{fecha(r.fecha)}</Td><Td right>{num(r.horas, 1)}</Td><Td right>{eur(r.coste)}</Td><Td right>{r.ventas ? eur(r.ventas) : '—'}</Td><Td right style={{ color: r.labor_pct > 30 ? tk.terra : r.labor_pct > 25 ? tk.clay : tk.iron }}>{pct(r.labor_pct)}</Td><Td right>{r.splh != null ? `${eur(r.splh)}/h` : '—'}</Td></Tr>)}</Table>}</Panel>
        </>
      )}
    </Page>
  )
}

function EmptyLabor() {
  return <EmptyState titulo="Sin turnos en el periodo" detalle="Este panel se calcula con los turnos planificados. Importa un CSV o Excel de turnos (o créalos a mano) para ver coste laboral, horas y desviaciones." accionLabel="Importar turnos" accionHref="/dashboard/labor/turnos" ayuda="Formato: fecha, empleado, inicio, fin, descanso, coste/hora." />
}
