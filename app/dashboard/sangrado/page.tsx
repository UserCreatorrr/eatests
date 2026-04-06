'use client'

import { useState } from 'react'
import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'
import FoodCostCalculator from '@/components/FoodCostCalculator'

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

type SelectedReceta = { id: number; nombre: string; precio_venta: number | null }

export default function SangradoPage() {
  const [selectedReceta, setSelectedReceta] = useState<SelectedReceta | null>(null)

  const columns: ColDef[] = [
    { label: 'Receta', render: r => r.nombre || '-', className: 'col-main' },
    { label: 'Categoria', render: r => r.categoria || '-' },
    { label: 'Raciones', render: r => r.raciones ?? '-' },
    { label: 'P.Venta', render: r => fmt(r.precio_venta), className: 'col-amount' },
    { label: 'Merma %', render: r => r.merma_pct != null ? <span className="badge badge-blue">{r.merma_pct}%</span> : '-' },
    { label: 'Activo', render: r => r.activo ? <span className="badge badge-green">Si</span> : <span className="badge badge-gray">No</span> },
    {
      label: 'Food Cost',
      render: r => (
        <button
          onClick={e => { e.stopPropagation(); setSelectedReceta({ id: r.id, nombre: r.nombre, precio_venta: r.precio_venta }) }}
          style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, backgroundColor: '#19f973', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#2a2522', fontWeight: 700 }}
        >
          Calcular
        </button>
      ),
    },
  ]

  return (
    <>
      <CRUDPage title="Escandallo / Sangrado" entity="escandallo-receta" fields={fields} columns={columns} />
      {selectedReceta && (
        <div className="p-8" style={{ paddingTop: 0 }}>
          <FoodCostCalculator
            recetaId={selectedReceta.id}
            recetaNombre={selectedReceta.nombre}
            precioVenta={selectedReceta.precio_venta}
            onClose={() => setSelectedReceta(null)}
          />
        </div>
      )}
    </>
  )
}
