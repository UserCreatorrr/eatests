'use client'

import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'nombre', label: 'Nombre receta' },
  { key: 'categoria', label: 'Categoria' },
  { key: 'descripcion', label: 'Descripcion' },
  { key: 'raciones', label: 'Raciones', type: 'number' },
  { key: 'precio_venta', label: 'Precio venta (EUR)', type: 'number' },
  { key: 'merma_pct', label: 'Merma %', type: 'number' },
  { key: 'ingredientes', label: 'Ingredientes (texto libre)' },
  { key: 'notas', label: 'Notas' },
]

function fmt(v: number | null) {
  if (v == null) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}

const columns: ColDef[] = [
  { label: 'Receta', render: r => r.nombre || '-', className: 'col-main' },
  { label: 'Categoria', render: r => r.categoria || '-' },
  { label: 'Raciones', render: r => r.raciones ?? '-' },
  { label: 'P.Venta', render: r => fmt(r.precio_venta), className: 'col-amount' },
  { label: 'Merma %', render: r => r.merma_pct != null ? <span className="badge badge-blue">{r.merma_pct}%</span> : '-' },
  { label: 'Activo', render: r => r.activo ? <span className="badge badge-green">Si</span> : <span className="badge badge-gray">No</span> },
]

export default function SangradoPage() {
  return <CRUDPage title="Escandallo / Sangrado" entity="escandallo-receta" fields={fields} columns={columns} />
}
