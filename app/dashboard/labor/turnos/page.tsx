'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { eur, fecha, hoyIso, num } from '@/lib/format'
import { Btn, Empty, Field, Input, Modal, Note, Page, Panel, Select, Table, Td, Textarea, Tr } from '@/components/ui'

const ALIASES: Record<string, string> = {
  centro: 'location', local: 'location', site: 'location', site_id: 'location', location: 'location',
  fecha: 'date', date: 'date', dia: 'date',
  empleado: 'employee_name', nombre: 'employee_name', employee_name: 'employee_name', trabajador: 'employee_name', persona: 'employee_name',
  id_empleado: 'employee_code', employee_id: 'employee_code', employee_code: 'employee_code', codigo_empleado: 'employee_code', codigo: 'employee_code',
  rol: 'role', role: 'role', puesto: 'role', categoria: 'role', servicio: 'service', service: 'service', area: 'service', turno: 'service',
  inicio: 'start_time', hora_inicio: 'start_time', entrada: 'start_time', start_time: 'start_time', start: 'start_time',
  fin: 'end_time', hora_fin: 'end_time', salida: 'end_time', end_time: 'end_time', end: 'end_time',
  descanso: 'break_minutes', break: 'break_minutes', break_minutes: 'break_minutes', pausa: 'break_minutes',
  coste_hora: 'hourly_cost', 'coste/hora': 'hourly_cost', hourly_cost: 'hourly_cost', precio_hora: 'hourly_cost', coste: 'hourly_cost',
  horas_reales: 'actual_hours', actual_hours: 'actual_hours', fichaje: 'actual_hours',
  timeslot_start: 'slot_start', franja_inicio: 'slot_start', slot_start: 'slot_start', timeslot_end: 'slot_end', franja_fin: 'slot_end', slot_end: 'slot_end',
  canal: 'channel', channel: 'channel', ventas: 'net_sales', ventas_netas: 'net_sales', sales_net: 'net_sales', net_sales: 'net_sales', importe: 'net_sales', neto: 'net_sales',
  comensales: 'covers', covers: 'covers', cubiertos: 'covers', pedidos: 'orders', orders: 'orders', tickets: 'tickets',
}
const SAMPLE: Record<'shifts' | 'sales', string> = {
  shifts: `fecha,empleado,rol,servicio,inicio,fin,descanso,coste_hora\n${hoyIso()},Ana Pérez,Cocina,Comida,10:00,18:00,30,11.50\n${hoyIso()},Carlos Ruiz,Sala,Cena,18:00,00:00,30,10.80`,
  sales: `fecha,franja_inicio,franja_fin,canal,ventas,comensales,tickets\n${hoyIso()},12:00,13:00,Sala,420.80,28,18\n${hoyIso()},13:00,14:00,Sala,1280.50,62,38`,
}
const norm = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_')

function splitLine(line: string, sep: string): string[] {
  const out: string[] = []; let cur = '', q = false
  for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q } else if (ch === sep && !q) { out.push(cur); cur = '' } else cur += ch }
  out.push(cur); return out.map(s => s.trim().replace(/^"|"$/g, ''))
}
function loadXLSX(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).XLSX) return resolve((window as any).XLSX)
    const s = document.createElement('script'); s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
    s.onload = () => (window as any).XLSX ? resolve((window as any).XLSX) : reject(new Error('XLSX no disponible')); s.onerror = () => reject(new Error('No se pudo cargar el lector de Excel. Exporta como CSV.')); document.head.appendChild(s)
  })
}

export default function TurnosPage() {
  const [tab, setTab] = useState<'shifts' | 'sales'>('shifts')
  const [fields, setFields] = useState<{ shifts: string[]; sales: string[] }>({ shifts: [], sales: [] })
  const [csv, setCsv] = useState(''), [headers, setHeaders] = useState<string[]>([]), [rows, setRows] = useState<Record<string, string>[]>([]), [mapping, setMapping] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false), [report, setReport] = useState<any>(null), [err, setErr] = useState('')
  const [list, setList] = useState<any[]>([]), [listFrom, setListFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10) }), [listTo, setListTo] = useState(hoyIso())
  const [modal, setModal] = useState(false), [form, setForm] = useState<Record<string, string>>({})
  const [employees, setEmployees] = useState<any[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const available = fields[tab]

  useEffect(() => { api.get('/api/labor/import').then(setFields).catch(() => {}); api.get('/api/labor/employees').then(r => setEmployees(r.data)).catch(() => {}) }, [])
  const loadList = useCallback(async () => { try { const r = await api.get(`/api/labor/${tab}?from=${listFrom}&to=${listTo}`); setList(r.data) } catch { setList([]) } }, [tab, listFrom, listTo])
  useEffect(() => { loadList() }, [loadList])

  function parse(text: string, forTab = tab) {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (!lines.length) { setHeaders([]); setRows([]); return }
    const sep = [',', ';', '\t', '|'].reduce((best, c) => lines[0].split(c).length > lines[0].split(best).length ? c : best, ',')
    const heads = splitLine(lines[0], sep)
    setHeaders(heads); setRows(lines.slice(1).map(l => { const cols = splitLine(l, sep); const o: Record<string, string> = {}; heads.forEach((h, i) => { o[h] = cols[i] ?? '' }); return o }))
    const avail = fields[forTab]
    setMapping(Object.fromEntries(heads.map(h => { const n = norm(h); const target = avail.includes(h) ? h : ALIASES[n] && avail.includes(ALIASES[n]) ? ALIASES[n] : '__skip__'; return [h, target] })))
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setErr(''); setReport(null)
    try {
      let text: string
      if (/\.(xlsx|xls)$/i.test(f.name)) { setBusy(true); const XLSX = await loadXLSX(); const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: ',', blankrows: false }) }
      else text = await f.text()
      setCsv(text); parse(text)
    } catch (x) { setErr(errorMessage(x)) } finally { setBusy(false); e.target.value = '' }
  }
  async function commit() {
    setBusy(true); setReport(null); setErr('')
    try { setReport(await api.post('/api/labor/import', { type: tab, rows, mapping })); await loadList() } catch (e) { setErr(errorMessage(e)) }
    setBusy(false)
  }
  async function saveManual() {
    setErr('')
    try {
      if (tab === 'shifts') await api.post('/api/labor/shifts', { shiftDate: form.date, startTime: form.start, endTime: form.end, breakMinutes: Number(form.break || 0), employeeId: form.employeeId ? Number(form.employeeId) : null, employeeName: form.employeeName || null, role: form.role || null, service: form.service || null, hourlyCost: form.cost ? Number(form.cost) : null })
      else await api.post('/api/labor/sales', { saleDate: form.date, slotStart: form.start, slotEnd: form.end || null, channel: form.channel || null, netSales: Number(form.net || 0), covers: form.covers ? Number(form.covers) : null, tickets: form.tickets ? Number(form.tickets) : null })
      setModal(false); setForm({}); await loadList()
    } catch (e) { setErr(errorMessage(e)) }
  }
  async function remove(id: number) { try { await api.del(`/api/labor/${tab}/${id}`); await loadList() } catch (e) { alert(errorMessage(e)) } }

  return (
    <Page eyebrow="Labor cost · Horarios y ventas" title="Importa horarios y ventas por franja" subtitle="CSV o Excel exportado de Factorial, Sesame, el TPV o un Excel a mano. Mapea columnas y carga. Reimportar el mismo fichero no duplica."
      actions={<Btn kind="ghost" onClick={() => { setForm({ date: hoyIso() }); setErr(''); setModal(true) }}>+ A MANO</Btn>}>
      <div style={{ display: 'flex', border: `1.5px solid ${tk.iron}`, marginBottom: 18, width: 'fit-content' }}>
        {(['shifts', 'sales'] as const).map(t => <button key={t} onClick={() => { setTab(t); setHeaders([]); setRows([]); setReport(null); if (csv) parse(csv, t) }} style={{ padding: '9px 18px', background: tab === t ? tk.iron : tk.paper, color: tab === t ? tk.cream : tk.iron, border: 'none', cursor: 'pointer', fontFamily: ff.mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t === 'shifts' ? 'Turnos (plan)' : 'Ventas por franja'}</button>)}
      </div>
      <Panel>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <Btn onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? 'LEYENDO…' : 'SUBIR CSV / EXCEL'}</Btn>
            <Btn kind="ghost" onClick={() => { setCsv(SAMPLE[tab]); parse(SAMPLE[tab]) }}>PLANTILLA DE EJEMPLO</Btn>
            <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{ display: 'none' }} onChange={onFile} />
          </div>
          <p style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, margin: '0 0 8px' }}>Campos admitidos: {available.join(', ')}</p>
          <Textarea value={csv} onChange={e => { setCsv(e.target.value); parse(e.target.value) }} placeholder="O pega aquí tu CSV…" rows={5} />
        </div>
      </Panel>
      {headers.length > 0 && (
        <Panel title={`Mapeo de columnas · ${rows.length} filas`}>
          <Table head={['Columna del fichero', '→ campo', 'Ejemplo']}>
            {headers.map(h => <Tr key={h}><Td><strong>{h}</strong></Td><Td><Select value={mapping[h] || '__skip__'} onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))} style={{ width: 220, padding: '5px 8px', fontSize: 11 }}><option value="__skip__">— ignorar —</option>{available.map(f => <option key={f} value={f}>{f}</option>)}</Select></Td><Td style={{ color: tk.iron60 }}>{rows[0]?.[h] || '—'}</Td></Tr>)}
          </Table>
          <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end' }}><Btn onClick={commit} disabled={busy || !rows.length}>{busy ? 'CARGANDO…' : `IMPORTAR ${rows.length} FILAS →`}</Btn></div>
        </Panel>
      )}
      {err && <Note tone="crit">{err}</Note>}
      {report && (
        <Note tone={report.errors.length ? 'warn' : 'ok'}>
          <strong>{report.inserted} de {report.total} filas importadas</strong>{report.skipped ? ` · ${report.skipped} ya existían (omitidas)` : ''}
          {report.errors.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>{report.errors.slice(0, 8).map((e: any, i: number) => <li key={i}>Fila {e.row}: {e.reason}</li>)}{report.errors.length > 8 && <li>… y {report.errors.length - 8} más</li>}</ul>}
          {report.link && <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${tk.iron20}` }}><strong>{report.link.linked}</strong> turno(s) vinculados a un empleado del maestro{report.link.unlinked > 0 && <> · <strong style={{ color: tk.clay }}>{report.link.unlinked} sin vincular</strong>: {report.link.unlinkedNames.join(' · ')}. Se guardan, pero sin coste/hora ni métricas por persona hasta crearlos en <a href="/dashboard/labor/empleados" style={{ color: tk.appleDeep }}>Empleados</a>.</>}</div>}
        </Note>
      )}
      <Panel title={tab === 'shifts' ? 'Turnos cargados' : 'Ventas por franja cargadas'} right={<span style={{ display: 'flex', gap: 6, alignItems: 'center', fontFamily: ff.mono, fontSize: 11 }}><input type="date" value={listFrom} onChange={e => setListFrom(e.target.value)} style={{ padding: '3px 6px', border: `1px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 11 }} />→<input type="date" value={listTo} onChange={e => setListTo(e.target.value)} style={{ padding: '3px 6px', border: `1px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 11 }} /></span>}>
        {list.length === 0 ? <Empty>Nada en el periodo.</Empty> : tab === 'shifts' ? (
          <Table head={['Fecha', 'Empleado', 'Rol', 'Servicio', 'Horario', 'Descanso', 'Horas plan', 'Real', '€/h', '']} right={[5, 6, 7, 8]}>
            {list.map(s => <Tr key={s.id}><Td>{fecha(s.shift_date)}</Td><Td>{s.employee_name}{!s.employee_id && <span title="Sin vincular al maestro" style={{ color: tk.clay, marginLeft: 4 }}>•</span>}</Td><Td>{s.role || '—'}</Td><Td>{s.service || '—'}</Td><Td>{s.start_time}–{s.end_time}{s.overnight ? ' (+1)' : ''}</Td><Td right>{s.break_minutes} min</Td><Td right>{num(s.planned_hours, 2)}</Td><Td right>{s.actual_hours != null ? num(s.actual_hours, 2) : '—'}</Td><Td right>{s.hourly_cost != null ? eur(s.hourly_cost) : <span style={{ color: tk.clay }}>—</span>}</Td><Td right><Btn small kind="danger" onClick={() => remove(s.id)}>×</Btn></Td></Tr>)}
          </Table>
        ) : (
          <Table head={['Fecha', 'Franja', 'Canal', 'Ventas netas', 'Comensales', 'Tickets', '']} right={[3, 4, 5]}>
            {list.map(s => <Tr key={s.id}><Td>{fecha(s.sale_date)}</Td><Td>{s.slot_start}{s.slot_end ? `–${s.slot_end}` : ''}</Td><Td>{s.channel}</Td><Td right>{eur(s.net_sales)}</Td><Td right>{s.covers ?? '—'}</Td><Td right>{s.tickets ?? '—'}</Td><Td right><Btn small kind="danger" onClick={() => remove(s.id)}>×</Btn></Td></Tr>)}
          </Table>
        )}
      </Panel>
      {modal && (
        <Modal title={tab === 'shifts' ? 'Nuevo turno' : 'Ventas de una franja'} onClose={() => setModal(false)} width={520}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Fecha"><Input type="date" value={form.date ?? ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></Field>
            {tab === 'shifts' ? <Field label="Empleado"><Select value={form.employeeId ?? ''} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}><option value="">— nombre libre —</option>{employees.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field> : <Field label="Canal"><Input value={form.channel ?? ''} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} placeholder="sala" /></Field>}
            {tab === 'shifts' && !form.employeeId && <Field label="Nombre"><Input value={form.employeeName ?? ''} onChange={e => setForm(f => ({ ...f, employeeName: e.target.value }))} /></Field>}
            <Field label="Inicio (HH:MM)"><Input value={form.start ?? ''} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} placeholder="12:00" /></Field>
            <Field label="Fin (HH:MM)"><Input value={form.end ?? ''} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} placeholder="16:00" /></Field>
            {tab === 'shifts' ? <>
              <Field label="Descanso (min)"><Input type="number" min={0} value={form.break ?? ''} onChange={e => setForm(f => ({ ...f, break: e.target.value }))} /></Field>
              <Field label="Coste €/h" hint="Vacío = el del empleado"><Input type="number" step="0.01" min={0} value={form.cost ?? ''} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} /></Field>
              <Field label="Rol"><Input value={form.role ?? ''} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} /></Field>
              <Field label="Servicio"><Input value={form.service ?? ''} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} placeholder="Comida / Cena" /></Field>
            </> : <>
              <Field label="Ventas netas (€)"><Input type="number" step="0.01" min={0} value={form.net ?? ''} onChange={e => setForm(f => ({ ...f, net: e.target.value }))} /></Field>
              <Field label="Comensales"><Input type="number" min={0} value={form.covers ?? ''} onChange={e => setForm(f => ({ ...f, covers: e.target.value }))} /></Field>
              <Field label="Tickets"><Input type="number" min={0} value={form.tickets ?? ''} onChange={e => setForm(f => ({ ...f, tickets: e.target.value }))} /></Field>
            </>}
          </div>
          {err && <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.terra, margin: '14px 0 0' }}>{err}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}><Btn kind="ghost" onClick={() => setModal(false)}>CANCELAR</Btn><Btn onClick={saveManual} disabled={!form.date || !form.start}>GUARDAR</Btn></div>
        </Modal>
      )}
    </Page>
  )
}
