'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Ingrediente = {
  id: number
  codi: string | null
  descr: string | null
  type: string | null
  unit: string | null
  cost: number | null
  proveedor_nombre: string | null
  almacen_principal: string | null
  almacen_secundario: string | null
}

const SIN_ASIGNAR = 'Sin asignar'

// Color por almacén para identificarlos de un vistazo
const ALMACEN_COLOR: Record<string, string> = {
  'Nevera': '#3d7ea6',
  'Nevera pescado': '#3d7ea6',
  'Nevera lácteos': '#5a9bbf',
  'Congelador': '#5e8ca8',
  'Seco / Despensa': '#b08348',
  'Despensa seca': '#b08348',
  'Barra': '#8a6d3b',
  'Cocina caliente': '#a83e1e',
  'Cocina fría': '#0fa651',
  'Bodega': '#7a4a6b',
  [SIN_ASIGNAR]: '#a83e1e',
}

function fmt(v: number | null) {
  if (v == null) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}

export default function AlmacenesPage() {
  const [rows, setRows] = useState<Ingrediente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/data/ingredientes?limit=5000')
    const json = await res.json()
    setRows(json.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r =>
    !search || [r.descr, r.codi, r.type, r.proveedor_nombre, r.almacen_principal].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )

  // Agrupa por almacén principal
  const grupos = new Map<string, Ingrediente[]>()
  for (const r of filtered) {
    const key = r.almacen_principal?.trim() || SIN_ASIGNAR
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(r)
  }
  // Orden: almacenes con nombre primero (alfabético), "Sin asignar" al final
  const ordenados = Array.from(grupos.entries()).sort((a, b) => {
    if (a[0] === SIN_ASIGNAR) return 1
    if (b[0] === SIN_ASIGNAR) return -1
    return a[0].localeCompare(b[0])
  })

  const sinAsignar = rows.filter(r => !r.almacen_principal?.trim()).length

  return (
    <div className="p-8">
      <div className="page-header">
        <div>
          <h1 className="page-title">Almacenes</h1>
          <p className="page-subtitle">
            {grupos.size} ubicaciones · {rows.length} ingredientes
            {sinAsignar > 0 && <> · <span style={{ color: '#a83e1e' }}>{sinAsignar} sin almacén</span></>}
          </p>
        </div>
        <Link href="/dashboard/ingredientes" className="btn-primary" style={{ textDecoration: 'none' }}>Gestionar ingredientes →</Link>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar ingrediente, tipo, proveedor o almacén..."
          style={{ width: '100%', maxWidth: 480, padding: '10px 14px', borderRadius: 0, border: '1.5px solid #e8e2db', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#3d3834', outline: 'none', backgroundColor: 'var(--paper)', boxSizing: 'border-box' }}
          onFocus={e => e.currentTarget.style.borderColor = '#19f973'}
          onBlur={e => e.currentTarget.style.borderColor = '#e8e2db'}
        />
      </div>

      {loading ? (
        <p className="page-subtitle">Cargando...</p>
      ) : ordenados.length === 0 ? (
        <div style={{ backgroundColor: 'var(--paper)', border: '1px solid #e8e2db', padding: 40, textAlign: 'center' }}>
          <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 16, color: '#3d3834', margin: '0 0 6px' }}>Sin ingredientes</p>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#6c635a', margin: 0 }}>Añade ingredientes y asígnales un almacén para verlos agrupados aquí.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ordenados.map(([almacen, items]) => {
            const color = ALMACEN_COLOR[almacen] ?? '#6c635a'
            const total = items.reduce((s: number, i: Ingrediente) => s + (i.cost || 0), 0)
            return (
              <div key={almacen} style={{ backgroundColor: 'var(--paper)', border: '1px solid #e8e2db', overflow: 'hidden' }}>
                {/* Cabecera del almacén */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', backgroundColor: '#faf6ec', borderBottom: '1px solid #e8e2db' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 15, color: almacen === SIN_ASIGNAR ? '#a83e1e' : '#3d3834' }}>{almacen}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6c635a', marginLeft: 'auto' }}>
                    {items.length} ítem{items.length !== 1 ? 's' : ''} · {fmt(total)}/ud coste ref.
                  </span>
                </div>
                {/* Tabla de ingredientes del almacén */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {items.map((ing: Ingrediente, idx: number) => (
                      <tr key={ing.id} style={{ borderBottom: idx < items.length - 1 ? '1px solid #f0ebe2' : 'none' }}>
                        <td style={{ padding: '8px 16px', fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 13, color: '#3d3834' }}>{ing.descr || '-'}</td>
                        <td style={{ padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.45 }}>{ing.type || '-'}</td>
                        <td style={{ padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.55 }}>{ing.proveedor_nombre || 'sin proveedor'}</td>
                        <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                          {ing.almacen_secundario ? (
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, padding: '2px 7px', backgroundColor: '#ece4d8', color: '#6c635a', border: '1px solid #d8cdbb' }}>2ª: {ing.almacen_secundario}</span>
                          ) : null}
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', whiteSpace: 'nowrap' }}>{fmt(ing.cost)} <span style={{ opacity: 0.4 }}>/{ing.unit || 'ud'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
