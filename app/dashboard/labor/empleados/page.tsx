'use client'

import CRUDPage from '@/components/CRUDPage'

export default function EmpleadosPage() {
  return (
    <CRUDPage
      title="Empleados"
      entity="empleados"
      fields={[
        { key: 'employee_id', label: 'ID externo', type: 'text' },
        { key: 'nombre', label: 'Nombre', type: 'text' },
        { key: 'site_id', label: 'Centro', type: 'text' },
        { key: 'rol', label: 'Rol', type: 'text' },
        { key: 'tipo_contrato', label: 'Contrato', type: 'text' },
        { key: 'coste_hora', label: 'Coste €/h', type: 'number' },
        { key: 'coste_empresa', label: 'Coste empresa €/h', type: 'number' },
        { key: 'contract_hours_week', label: 'Horas semana', type: 'number' },
        { key: 'activo', label: 'Activo (1/0)', type: 'number' },
      ]}
      columns={[
        { label: 'Nombre',  render: r => r.nombre },
        { label: 'Centro',  render: r => r.site_id || '—' },
        { label: 'Rol',     render: r => r.rol || '—' },
        { label: 'Contrato',render: r => r.tipo_contrato || '—' },
        { label: '€/h',     render: r => r.coste_hora != null ? `${r.coste_hora}€` : '—' },
        { label: 'h/sem',   render: r => r.contract_hours_week != null ? `${r.contract_hours_week}h` : '—' },
        { label: 'Activo',  render: r => r.activo ? 'Sí' : 'No' },
      ]}
    />
  )
}
