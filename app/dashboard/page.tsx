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

  const totalPurchases = (purchaseTotals || []).reduce((sum, row) => sum + (row.total || 0), 0)
  const totalSales = (salesTotals || []).reduce((sum, row) => sum + (row.total || 0), 0)

  return {
    proveedores: proveedores || 0,
    pedidosCompra: pedidosCompra || 0,
    albaranesCompra: albaranesCompra || 0,
    facturasCompra: facturasCompra || 0,
    albaranesVenta: albaranesVenta || 0,
    facturasVenta: facturasVenta || 0,
    ingredientes: ingredientes || 0,
    herramientas: herramientas || 0,
    listaPedidos: listaPedidos || 0,
    totalPurchases,
    totalSales,
  }
}

export default async function DashboardPage() {
  const stats = await getStats()

  const statCards = [
    {
      label: 'Proveedores',
      value: stats.proveedores,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: 'Pedidos Compra',
      value: stats.pedidosCompra,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      label: 'Albaranes Compra',
      value: stats.albaranesCompra,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      ),
    },
    {
      label: 'Facturas Compra',
      value: stats.facturasCompra,
      color: 'text-red-600',
      bg: 'bg-red-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: 'Albaranes Venta',
      value: stats.albaranesVenta,
      color: 'text-green-600',
      bg: 'bg-green-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      label: 'Facturas Venta',
      value: stats.facturasVenta,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      ),
    },
    {
      label: 'Ingredientes',
      value: stats.ingredientes,
      color: 'text-lime-600',
      bg: 'bg-lime-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
    },
    {
      label: 'Herramientas',
      value: stats.herramientas,
      color: 'text-slate-600',
      bg: 'bg-slate-100',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: 'Lista Pedidos',
      value: stats.listaPedidos,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
    },
  ]

  const totalRecords = stats.proveedores + stats.pedidosCompra + stats.albaranesCompra +
    stats.facturasCompra + stats.albaranesVenta + stats.facturasVenta +
    stats.ingredientes + stats.herramientas + stats.listaPedidos

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Panel de Control</h1>
        <p className="text-slate-500 mt-1">Resumen de tu actividad gastronómica</p>
      </div>

      {/* Financials */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="stat-card border-l-4 border-l-red-400">
          <p className="text-sm text-slate-500 mb-1">Total Compras (facturas)</p>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats.totalPurchases)}</p>
        </div>
        <div className="stat-card border-l-4 border-l-green-400">
          <p className="text-sm text-slate-500 mb-1">Total Ventas (facturas)</p>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats.totalSales)}</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className={`w-10 h-10 ${card.bg} ${card.color} rounded-xl flex items-center justify-center mb-3`}>
              {card.icon}
            </div>
            <p className="text-2xl font-bold text-slate-900">{card.value.toLocaleString('es-ES')}</p>
            <p className="text-sm text-slate-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {totalRecords === 0 && (
        <div className="mt-12 text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Sin datos importados</h3>
          <p className="text-slate-500 mb-6">Importa tus datos desde TSpoonLab para comenzar.</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Importar desde TSpoonLab
          </a>
        </div>
      )}
    </div>
  )
}
