'use client'
import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'codi', label: 'Codigo' },
  { key: 'descr', label: 'Nombre' },
  { key: 'type', label: 'Tipo' },
  { key: 'unit', label: 'Unidad' },
  { key: 'id_unit', label: 'ID Unidad', type: 'number' },
  { key: 'cost', label: 'Coste (EUR)', type: 'number' },
  { key: 'color', label: 'Color' },
  { key: 'has_data', label: 'Tiene datos (1=si)', type: 'number' },
]

function fmt(v: number | null) {
  if (v == null) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}

const columns: ColDef[] = [
  { label: 'Codigo', render: r => r.codi || '-', className: 'col-mono' },
  { label: 'Nombre', render: r => r.descr || '-', className: 'col-main' },
  { label: 'Tipo', render: r => r.type || '-' },
  { label: 'Unidad', render: r => r.unit || '-' },
  { label: 'Coste', render: r => fmt(r.cost), className: 'col-amount' },
  { label: 'Color', render: r => r.color ? <span className="badge badge-blue">{r.color}</span> : '-' },
  { label: 'Con datos', render: r => r.has_data ? <span className="badge badge-green">Si</span> : <span className="badge badge-gray">No</span> },
]

export default function IngredientesPage() {
  return <CRUDPage title="Ingredientes" entity="ingredientes" fields={fields} columns={columns} />
}
