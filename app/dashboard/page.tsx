export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

function fmt(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

async function getStats() {
  const [
    { count: nIngredientes },
    { count: nHerramientas },
    { count: nProveedores },
    { count: nDetalles },
    { count: nPedidos },
    { count: nAlbaranesCompra },
    { count: nFacturasCompra },
    { count: nAlbaranesVenta },
    { count: nFacturasVenta },
    { count: nListaPedidos },
    comprasRes,
    ventasRes,
    { data: sinCoste },
  ] = await Promise.all([
    supabaseAdmin.from('tspoonlab_ingredientes').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_herramientas').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_proveedores').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_vendor_details').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_pedidos_compra').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_albaranes_compra').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_facturas_compra').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_albaranes_venta').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_facturas_venta').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_lista_pedidos').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_facturas_compra').select('total').not('total', 'is', null),
    supabaseAdmin.from('tspoonlab_facturas_venta').select('total').not('total', 'is', null),
    supabaseAdmin.from('tspoonlab_ingredientes').select('id').is('cost', null).limit(500),
  ])

  const totalCompras = (comprasRes.data || []).reduce((s: number, r: any) => s + (r.total || 0), 0)
  const totalVentas = (ventasRes.data || []).reduce((s: number, r: any) => s + (r.total || 0), 0)
  const nSinCoste = (sinCoste || []).length

  return {
    nIngredientes: nIngredientes ?? 0,
    nHerramientas: nHerramientas ?? 0,
    nProveedores: nProveedores ?? 0,
    nDetalles: nDetalles ?? 0,
    nPedidos: nPedidos ?? 0,
    nAlbaranesCompra: nAlbaranesCompra ?? 0,
    nFacturasCompra: nFacturasCompra ?? 0,
    nAlbaranesVenta: nAlbaranesVenta ?? 0,
    nFacturasVenta: nFacturasVenta ?? 0,
    nListaPedidos: nListaPedidos ?? 0,
    totalCompras,
    totalVentas,
    nSinCoste,
  }
}

type StatCard = { label: string; value: string | number; sub?: string; href: string; alert?: boolean }

export default async function DashboardPage() {
  const s = await getStats()

  const stockCards: StatCard[] = [
    { label: 'Ingredientes', value: s.nIngredientes, sub: s.nSinCoste > 0 ? s.nSinCoste + ' sin coste' : undefined, href: '/dashboard/ingredientes', alert: s.nSinCoste > 0 },
    { label: 'Herramientas', value: s.nHerramientas, href: '/dashboard/herramientas' },
    { label: 'Proveedores', value: s.nProveedores, sub: s.nDetalles + ' detalles', href: '/dashboard/proveedores' },
    { label: 'Lista Pedidos', value: s.nListaPedidos, href: '/dashboard/lista-pedidos' },
  ]

  const comprasCards: StatCard[] = [
    { label: 'Pedidos', value: s.nPedidos, href: '/dashboard/compras/pedidos' },
    { label: 'Albaranes', value: s.nAlbaranesCompra, href: '/dashboard/compras/albaranes' },
    { label: 'Facturas', value: s.nFacturasCompra, href: '/dashboard/compras/facturas' },
  ]

  const ventasCards: StatCard[] = [
    { label: 'Albaranes', value: s.nAlbaranesVenta, href: '/dashboard/ventas/albaranes' },
    { label: 'Facturas', value: s.nFacturasVenta, href: '/dashboard/ventas/facturas' },
  ]

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="page-title">Cocina</h1>
        <p className="page-subtitle">Vista operativa de tu restaurante</p>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl p-6 relative overflow-hidden" style={{ backgroundColor: '#3d3834' }}>
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'url(/logos/grid-negative.svg)', backgroundSize: '200px' }} />
          <p className="relative" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(223,213,201,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Coste Total Compras</p>
          <p className="stat-value text-3xl relative mt-2" style={{ color: '#dfd5c9' }}>{fmt(s.totalCompras)}</p>
          <p className="relative mt-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(223,213,201,0.3)', letterSpacing: '0.08em' }}>{s.nFacturasCompra.toLocaleString('es-ES')} facturas · {s.nAlbaranesCompra.toLocaleString('es-ES')} albaranes</p>
        </div>
        <div className="rounded-xl p-6 relative overflow-hidden" style={{ backgroundColor: '#19f973' }}>
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'url(/logos/grid-positive.png)', backgroundSize: '200px' }} />
          <p className="relative" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(42,37,34,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total Ventas</p>
          <p className="stat-value text-3xl relative mt-2" style={{ color: '#2a2522' }}>{fmt(s.totalVentas)}</p>
          <p className="relative mt-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(42,37,34,0.4)', letterSpacing: '0.08em' }}>{s.nFacturasVenta.toLocaleString('es-ES')} facturas · {s.nAlbaranesVenta.toLocaleString('es-ES')} albaranes</p>
        </div>
      </div>

      {/* Stock */}
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(61,56,52,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>Stock & Inventario</p>
      <div className="grid grid-cols-4 gap-3 mb-8">
        {stockCards.map(c => (
          <Link key={c.href} href={c.href} className="stat-card group hover:shadow-md transition-shadow">
            <p className="stat-value text-2xl">{typeof c.value === 'number' ? c.value.toLocaleString('es-ES') : c.value}</p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(61,56,52,0.4)', marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{c.label}</p>
            {c.sub && <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', marginTop: '4px', color: c.alert ? '#dc2626' : 'rgba(61,56,52,0.35)' }}>{c.sub}</p>}
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#19f973', marginTop: '8px', opacity: 0 }} className="group-hover:opacity-100 transition-opacity">Ver →</p>
          </Link>
        ))}
      </div>

      {/* Compras */}
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(61,56,52,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>Compras</p>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {comprasCards.map(c => (
          <Link key={c.href} href={c.href} className="stat-card group hover:shadow-md transition-shadow">
            <p className="stat-value text-2xl">{typeof c.value === 'number' ? c.value.toLocaleString('es-ES') : c.value}</p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(61,56,52,0.4)', marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{c.label}</p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#19f973', marginTop: '8px', opacity: 0 }} className="group-hover:opacity-100 transition-opacity">Ver →</p>
          </Link>
        ))}
      </div>

      {/* Ventas */}
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(61,56,52,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>Ventas</p>
      <div className="grid grid-cols-3 gap-3">
        {ventasCards.map(c => (
          <Link key={c.href} href={c.href} className="stat-card group hover:shadow-md transition-shadow">
            <p className="stat-value text-2xl">{typeof c.value === 'number' ? c.value.toLocaleString('es-ES') : c.value}</p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(61,56,52,0.4)', marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{c.label}</p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#19f973', marginTop: '8px', opacity: 0 }} className="group-hover:opacity-100 transition-opacity">Ver →</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
