'use client'

import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'codi', label: 'Codigo' },
  { key: 'descr', label: 'Nombre' },
  { key: 'type', label: 'Tipo' },
  { key: 'unit', label: 'Unidad' },
  { key: 'cost', label: 'Coste (EUR)', type: 'number' },
]

function fmt(v: number | null) {
  if (v == null) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}

const columns: ColDef[] = [
  { label: 'Codigo', render: r => r.codi || '-', className: 'col-mono' },
  { label: 'Nombre', render: r => r.descr || '-', className: 'col-main' },
  { label: 'Tipo', render: r => r.type || '-' },
  { label: 'Con datos', render: r => r.hasData ? <span className="badge badge-green">Si</span> : <span className="badge badge-gray">No</span> },
  { label: 'Unidad', render: r => r.unit || '-' },
  { label: 'Coste', render: r => fmt(r.cost), className: 'col-amount' },
]

export default function HerramientasPage() {
  return <CRUDPage title="Herramientas" entity="herramientas" fields={fields} columns={columns} />
}
