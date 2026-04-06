'use client'

import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'codi', label: 'Codigo' },
  { key: 'descr', label: 'Nombre' },
  { key: 'type', label: 'Tipo' },
  { key: 'unit', label: 'Unidad' },
  { key: 'cost', label: 'Coste (EUR)', type: 'number' },
  { key: 'color', label: 'Color' },
]

function formatCurrency(v: number | null) {
  if (v == null) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}

const columns: ColDef[] = [
  { label: 'Codigo', render: r => r.codi || '-', className: 'col-mono' },
  { label: 'Nombre', render: r => r.descr || '-', className: 'col-main' },
  { label: 'Tipo', render: r => r.type || '-' },
  { label: 'Unidad', render: r => r.unit || '-' },
  { label: 'Coste', render: r => formatCurrency(r.cost), className: 'col-amount' },
  { label: 'Color', render: r => r.color ? <span className="badge badge-blue">{r.color}</span> : '-' },
]

export default function IngredientesPage() {
  return <CRUDPage title="Ingredientes" entity="ingredientes" fields={fields} columns={columns} />
}
