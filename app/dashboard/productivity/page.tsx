'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { eur, fecha, num, pct } from '@/lib/format'
import EmptyState from '@/components/EmptyState'
import { Loading, Note, Page, Panel, Select, Stat, Table, Td } from '@/components/ui'
import { useRange } from '@/components/useRange'

export default function ProductivityPage() {
  const { range, picker } = useRange()
  const [locations, setLocations] = useState<any[]>([]), [locationId, setLocationId] = useState('')
  const [data, setData] = useState<any>(null), [loading, setLoading] = useState(true), [err, setErr] = useState('')
  useEffect(() => { api.get('/api/locations').then(r => setLocations(r.data)).catch(() => {}) }, [])
  useEffect(() => {
    if (!range) return
    setLoading(true)
    api.get(`/api/labor/productivity?from=${range.from}&to=${range.to}${locationId ? `&locationId=${locationId}` : ''}`).then(setData).catch(e => setErr(errorMessage(e))).finally(() => setLoading(false))
  }, [range?.from, range?.to, locationId]) // eslint-disable-line react-hooks/exhaustive-deps
  const s = data?.summary
  const src = data?.hours_source
  const color = (st: string) => st === 'crit' ? tk.terra : st === 'warn' ? tk.clay : tk.appleDeep
  const bg = (st: string) => st === 'crit' ? tk.terraSoft : st === 'warn' ? tk.claySoft : tk.appleSoft

  return (
    <Page eyebrow="Productivity · Visión general" title="¿Qué rendimiento te devuelve el equipo?" subtitle="Ventas por hora (SPLH), por empleado, tickets por hora y prime cost. Franjas muertas y coste de ineficiencia frente al objetivo.">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>{picker}{locations.length > 0 && <Select value={locationId} onChange={e => setLocationId(e.target.value)} style={{ width: 200 }}><option value="">Todos los centros</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>}{data && <span style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.iron40 }}>{fecha(data.from)} → {fecha(data.to)}</span>}</div>
      {err && <Note tone="crit">{err}</Note>}
      {loading || !s ? <Loading /> : (
        <>
          {(src === 'planned' || src === 'mixed') && <Note tone="warn">{src === 'planned' ? 'Calculado sobre HORAS PLANIFICADAS: no hay fichajes cargados, así que es una previsión, no el resultado real.' : `Horas mixtas: ${data.shifts_with_actual} de ${data.shifts_total} turnos tienen fichaje; el resto usa horas planificadas.`}</Note>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 12 }}>
            <Stat label="SPLH" value={s.splh != null ? `${eur(s.splh)}/h` : '—'} sub={src === 'actual' ? 'ventas / hora trabajada' : 'ventas / hora planificada'} />
            <Stat label="Ventas / empleado" value={eur(s.ventas_por_empleado)} sub="por turno" />
            <Stat label="Tickets / hora" value={s.tickets_por_hora != null ? num(s.tickets_por_hora, 1) : '—'} />
            <Stat label="Índice de productividad" value={s.productividad_index ?? '—'} sub="SPLH real / objetivo (100 = objetivo)" tone={s.productividad_index == null ? undefined : s.productividad_index < 60 ? 'crit' : s.productividad_index < 85 ? 'warn' : 'ok'} />
            <Stat label="Prime cost %" value={pct(s.prime_cost_pct)} sub="(compras + labor) / ventas · ideal < 60%" tone={s.prime_cost_pct == null ? undefined : s.prime_cost_pct > 70 ? 'crit' : s.prime_cost_pct > 60 ? 'warn' : 'ok'} />
            <Stat label="Coste de ineficiencia" value={eur(s.coste_ineficiencia)} sub="horas de más × coste/h frente al objetivo" tone={s.coste_ineficiencia == null ? undefined : s.coste_ineficiencia > 200 ? 'crit' : s.coste_ineficiencia > 50 ? 'warn' : undefined} />
          </div>
          <Panel title="SPLH por franja frente al objetivo">
            {s.por_franja.length === 0 ? <EmptyState titulo="Sin productividad para este periodo" detalle="El SPLH por franja necesita turnos (horas) y ventas por franja del mismo día y centro. Falta al menos una de las dos fuentes." accionLabel="Importar turnos y ventas" accionHref="/dashboard/labor/turnos" ayuda="Define el objetivo de ventas por hora en Labor › Turno ideal." /> : (
              <Table head={['Franja', 'Ventas', 'Horas', 'SPLH', 'Objetivo', 'Estado']} right={[1, 2, 3, 4]}>
                {s.por_franja.map((f: any) => <tr key={f.slot} style={{ borderTop: `1px solid ${tk.iron20}`, background: bg(f.status) }}><Td><strong>{f.slot}</strong></Td><Td right>{eur(f.ventas)}</Td><Td right>{num(f.horas, 1)}</Td><Td right style={{ color: color(f.status), fontWeight: 600 }}>{f.splh != null ? `${eur(f.splh)}/h` : '—'}</Td><Td right style={{ color: tk.iron60 }}>{f.target_splh != null ? `${eur(f.target_splh)}/h` : '—'}</Td><Td><span style={{ fontFamily: ff.mono, fontSize: 9, letterSpacing: '0.14em', padding: '3px 7px', border: `1px solid ${color(f.status)}`, color: color(f.status), background: tk.paper }}>{f.status === 'crit' ? 'CRÍT.' : f.status === 'warn' ? 'BAJO' : 'OK'}</span></Td></tr>)}
              </Table>
            )}
          </Panel>
        </>
      )}
    </Page>
  )
}
