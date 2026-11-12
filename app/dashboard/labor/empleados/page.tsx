'use client'
import { useEffect, useState } from 'react'
import CRUDPage, { F, type ColDef, type FieldDef } from '@/components/CRUDPage'
import { Badge } from '@/components/ui'
import { api } from '@/lib/api'
import { eur } from '@/lib/format'

export default function EmpleadosPage() {
  const [locations, setLocations] = useState<any[]>([])
  useEffect(() => { api.get('/api/locations').then(r => setLocations(r.data)).catch(() => {}) }, [])
  const fields: FieldDef[] = [
    { key: 'name', label: 'Nombre', required: true }, { key: 'code', label: 'Código / ID externo', hint: 'El del CSV de turnos (Factorial, Sesame…)' },
    { key: 'role', label: 'Rol' }, { key: 'contractType', label: 'Tipo de contrato' },
    { key: 'hourlyCost', label: 'Coste €/h', type: 'number' }, { key: 'employerCost', label: 'Coste empresa €/h', type: 'number' },
    { key: 'contractHoursWeek', label: 'Horas / semana', type: 'number' }, { key: 'locationId', label: 'Centro', type: 'select', options: locations.map(l => ({ value: String(l.id), label: l.name })) },
    { key: 'active', label: 'Activo', type: 'checkbox' },
  ]
  const columns: ColDef[] = [
    { label: 'Nombre', render: r => <span style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 13 }}>{r.name}</span> }, { label: 'Código', render: r => r.code || '—' },
    { label: 'Rol', render: r => r.role || '—' }, { label: 'Contrato', render: r => r.contract_type || '—' },
    { label: '€/h', render: r => r.hourly_cost != null ? eur(r.hourly_cost) : '—', right: true }, { label: 'h/sem', render: r => r.contract_hours_week != null ? `${r.contract_hours_week} h` : '—', right: true },
    { label: 'Centro', render: r => locations.find(l => l.id === r.location_id)?.name || '—' }, { label: 'Estado', render: r => <Badge tone={r.active ? 'ok' : 'neutral'}>{r.active ? 'Activo' : 'Baja'}</Badge> },
  ]
  return (
    <CRUDPage title="Empleados" eyebrow="Labor cost" endpoint="/api/labor/employees" query="all=1" fields={fields} columns={columns} singular="empleado" canDelete={false}
      subtitle="El coste/hora del empleado se hereda en sus turnos si el CSV no lo trae."
      fromRow={r => ({ name: r.name ?? '', code: r.code ?? '', role: r.role ?? '', contractType: r.contract_type ?? '', hourlyCost: r.hourly_cost != null ? String(r.hourly_cost) : '', employerCost: r.employer_cost != null ? String(r.employer_cost) : '', contractHoursWeek: r.contract_hours_week != null ? String(r.contract_hours_week) : '', locationId: r.location_id ? String(r.location_id) : '', active: r.active ? '1' : '0' })}
      toBody={(f, editing) => ({ name: f.name, code: F.str(f.code), role: F.str(f.role), contractType: F.str(f.contractType), hourlyCost: F.num(f.hourlyCost), employerCost: F.num(f.employerCost), contractHoursWeek: F.num(f.contractHoursWeek), locationId: F.num(f.locationId), active: editing ? F.bool(f.active) : true })} />
  )
}
