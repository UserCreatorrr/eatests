'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'
import FoodCostCalculator from '@/components/FoodCostCalculator'

const fields: FieldDef[] = [
  { key: 'nombre', label: 'Nombre receta' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'descripcion', label: 'Descripción' },
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

type SelectedReceta = {
  id: number; nombre: string; precio_venta: number | null; raciones: number | null
  es_subreceta?: number | null; cantidad_producida?: number | null; unidad_producida?: string | null
}

export default function SangradoPage() {
  const [selectedReceta, setSelectedReceta] = useState<SelectedReceta | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  function openCalc(r: SelectedReceta) {
    setSelectedReceta(r)
    setDrawerVisible(true)
  }

  // Entrar en la elaboración que usa una línea, sin salir del panel. Es el
  // equivalente al chevron que TSpoonLab pone en cada línea de composición.
  async function abrirSubreceta(id: number) {
    const res = await fetch('/api/recetas').then(r => r.json()).catch(() => ({ recetas: [] }))
    const r = (res.recetas || []).find((x: any) => x.id === id)
    if (r) openCalc({ id: r.id, nombre: r.nombre, precio_venta: r.precio_venta, raciones: r.raciones, es_subreceta: r.es_subreceta, cantidad_producida: r.cantidad_producida, unidad_producida: r.unidad_producida })
  }

  function closeCalc() {
    setDrawerVisible(false)
    setTimeout(() => setSelectedReceta(null), 300)
  }

  const columns: ColDef[] = [
    { label: 'Receta', render: r => r.nombre || '-', className: 'col-main' },
    { label: 'Categoría', render: r => r.categoria || '-' },
    { label: 'Tipo', render: r => r.es_subreceta
        ? <span className="badge badge-blue">Elaboración</span>
        : <span className="badge badge-gray">Plato</span> },
    { label: 'Raciones', render: r => r.es_subreceta
        ? (r.cantidad_producida ? `${r.cantidad_producida} ${r.unidad_producida || ''}` : 'sin definir')
        : (r.raciones ?? '-') },
    { label: 'P. Venta', render: r => fmt(r.precio_venta), className: 'col-amount' },
    { label: 'Merma %', render: r => r.merma_pct != null ? <span className="badge badge-blue">{r.merma_pct}%</span> : '-' },
    { label: 'Activo', render: r => r.activo ? <span className="badge badge-green">Sí</span> : <span className="badge badge-gray">No</span> },
    {
      label: 'Food Cost',
      render: r => (
        <button
          onClick={e => { e.stopPropagation(); openCalc({ id: r.id, nombre: r.nombre, precio_venta: r.precio_venta, raciones: r.raciones, es_subreceta: r.es_subreceta, cantidad_producida: r.cantidad_producida, unidad_producida: r.unidad_producida }) }}
          style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, backgroundColor: '#19f973', border: '1.5px solid #3d3834', borderRadius: 0, padding: '4px 10px', cursor: 'pointer', color: '#2a2522', fontWeight: 700 }}
        >
          Calcular
        </button>
      ),
    },
  ]

  return (
    <>
      {/* Alta masiva desde recetario en Excel (clientes sin software previo) */}
      <div style={{ padding: '20px 32px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          href="/dashboard/sangrado/importar"
          style={{ padding: '9px 18px', background: '#faf6ec', border: '1.5px solid #3d3834', fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 600, color: '#3d3834', letterSpacing: '0.06em', textDecoration: 'none' }}
        >
          IMPORTAR RECETARIO (EXCEL) →
        </Link>
      </div>
      <CRUDPage key={reloadKey} title="Escandallo / Sangrado" entity="escandallo-receta" fields={fields} columns={columns} />

      {/* Backdrop */}
      <div
        onClick={closeCalc}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)',
          zIndex: 200,
          opacity: drawerVisible ? 1 : 0,
          pointerEvents: drawerVisible ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(680px, 90vw)',
          backgroundColor: '#faf6ec',
          borderLeft: '1px solid #e8e2db',
          zIndex: 201,
          overflowY: 'auto',
          transform: drawerVisible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: drawerVisible ? '-8px 0 40px rgba(0,0,0,0.12)' : 'none',
        }}
      >
        {/* Drawer header */}
        <div style={{
          position: 'sticky', top: 0, backgroundColor: '#faf6ec',
          borderBottom: '1px solid #e8e2db',
          padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 1,
        }}>
          <div>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, textTransform: 'uppercase', color: '#3d3834', opacity: 0.45, margin: '0 0 2px', letterSpacing: 1 }}>Food Cost</p>
            <h2 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 17, color: '#3d3834', margin: 0 }}>
              {selectedReceta?.nombre || ''}
            </h2>
          </div>
          <button
            onClick={closeCalc}
            style={{ background: '#e8e2db', border: 'none', borderRadius: 0, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d3834', opacity: 0.7 }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Calculator content */}
        <div style={{ padding: '0 24px 32px' }}>
          {selectedReceta && (
            <FoodCostCalculator
              // `key` obliga a montar de nuevo el calculador al cambiar de
              // receta. Sin esto, al entrar en una elaboración desde una línea
              // el formulario conservaba el PVP, las raciones y la producción
              // de la receta anterior, y "Guardar ficha" los escribía en la
              // que no era.
              key={selectedReceta.id}
              recetaId={selectedReceta.id}
              recetaNombre={selectedReceta.nombre}
              precioVenta={selectedReceta.precio_venta}
              raciones={selectedReceta.raciones}
              esSubreceta={selectedReceta.es_subreceta}
              cantidadProducida={selectedReceta.cantidad_producida}
              unidadProducida={selectedReceta.unidad_producida}
              onAbrirSubreceta={abrirSubreceta}
              onClose={closeCalc}
              onSaved={() => setReloadKey(k => k + 1)}
              embedded
            />
          )}
        </div>
      </div>
    </>
  )
}
