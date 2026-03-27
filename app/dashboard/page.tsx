import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

async function getStats() {
  const [
    { count: proveedores },
    { count: pedidosCompra },
    { count: albaranesCompra },
    { count: facturasCompra },
    { count: albaranesVenta },
    { count: facturasVenta },
    { count: ingredientes },
    { count: herramientas },
    { count: listaPedidos },
    { data: purchaseTotals },
    { data: salesTotals },
  ] = await Promise.all([
    supabaseAdmin.from('tspoonlab_proveedores').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_pedidos_compra').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_albaranes_compra').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_facturas_compra').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_albaranes_venta').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_facturas_venta').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_ingredientes').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_herramientas').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_lista_pedidos').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tspoonlab_facturas_compra').select('total').not('total', 'is', null),
    supabaseAdmin.from('tspoonlab_facturas_venta').select('total').not('total', 'is', null),
  ])
  return {
    proveedores: proveedores || 0, pedidosCompra: pedidosCompra || 0,
    albaranesCompra: albaranesCompra || 0, facturasCompra: facturasCompra || 0,
    albaranesVenta: albaranesVenta || 0, facturasVenta: facturasVenta || 0,
    ingredientes: ingredientes || 0, herramientas: herramientas || 0, listaPedidos: listaPedidos || 0,
    totalPurchases: (purchaseTotals || []).reduce((s: number, r: {total?: number}) => s + (r.total || 0), 0),
    totalSales: (salesTotals || []).reduce((s: number, r: {total?: number}) => s + (r.total || 0), 0),
  }
}

const CARDS = [
  { label: 'Proveedores',     key: 'proveedores',     href: '/dashboard/proveedores' },
  { label: 'Pedidos Compra',  key: 'pedidosCompra',   href: '/dashboard/compras/pedidos' },
  { label: 'Albaranes Compra',key: 'albaranesCompra', href: '/dashboard/compras/albaranes' },
  { label: 'Facturas Compra', key: 'facturasCompra',  href: '/dashboard/compras/facturas' },
  { label: 'Albaranes Venta', key: 'albaranesVenta',  href: '/dashboard/ventas/albaranes' },
  { label: 'Facturas Venta',  key: 'facturasVenta',   href: '/dashboard/ventas/facturas' },
  { label: 'Ingredientes',    key: 'ingredientes',    href: '/dashboard/ingredientes' },
  { label: 'Herramientas',    key: 'herramientas',    href: '/dashboard/herramientas' },
  { label: 'Lista Pedidos',   key: 'listaPedidos',    href: '/dashboard/lista-pedidos' },
] as const

export default async function DashboardPage() {
  const stats = await getStats()
  const totalRecords = CARDS.reduce((s, c) => s + stats[c.key], 0)

  return (
    <div className="p-8 max-w-5xl">
      <div className="page-header">
        <h1 className="page-title">Panel de Control</h1>
        <p className="page-subtitle">Resumen de tu actividad gastronómica</p>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl p-6 relative overflow-hidden" style={{ backgroundColor: '#3d3834' }}>
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'url(/logos/grid-negative.svg)', backgroundSize: '200px' }} />
          <p className="page-subtitle relative" style={{ color: 'rgba(223,213,201,0.45)' }}>Total Compras</p>
          <p className="stat-value text-3xl relative mt-1" style={{ color: '#dfd5c9' }}>{formatCurrency(stats.totalPurchases)}</p>
          <p className="relative mt-2" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(223,213,201,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Facturas de compra</p>
        </div>
        <div className="rounded-xl p-6 relative overflow-hidden" style={{ backgroundColor: '#19f973' }}>
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'url(/logos/grid-positive.png)', backgroundSize: '200px' }} />
          <p className="relative" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(42,37,34,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total Ventas</p>
          <p className="stat-value text-3xl relative mt-1" style={{ color: '#2a2522' }}>{formatCurrency(stats.totalSales)}</p>
          <p className="relative mt-2" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(42,37,34,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Facturas de venta</p>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-3 gap-3">
        {CARDS.map((card) => (
          <Link key={card.key} href={card.href} className="stat-card group hover:shadow-md transition-shadow">
            <p className="stat-value text-2xl" style={{ color: '#3d3834' }}>{stats[card.key].toLocaleString('es-ES')}</p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(61,56,52,0.45)', marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{card.label}</p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#19f973', marginTop: '10px', opacity: 0, transition: 'opacity 0.15s' }} className="group-hover:opacity-100">Ver →</p>
          </Link>
        ))}
      </div>

      {totalRecords === 0 && (
        <div className="mt-12 text-center py-16 bg-white rounded-2xl" style={{ border: '1px solid #e8e2db' }}>
          <img src="/logos/profile.svg" alt="" style={{ width: '56px', height: '56px', margin: '0 auto 16px', opacity: 0.15 }} />
          <h3 style={{ fontFamily: "'Chillax', sans-serif", fontWeight: 600, color: '#3d3834', marginBottom: '8px' }}>Sin datos importados</h3>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'rgba(61,56,52,0.45)', marginBottom: '24px' }}>Importa tus datos desde TSpoonLab para comenzar.</p>
          <a href="/" className="btn-green">Importar desde TSpoonLab</a>
        </div>
      )}
    </div>
  )
}
