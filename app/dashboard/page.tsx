import { supabaseAdmin } from '@/lib/supabase'

async function getStats() {
  const [
    { count: costCenters },
    { count: vendors },
    { count: purchaseOrders },
    { count: purchaseDeliveries },
    { count: purchaseInvoices },
    { count: salesDeliveries },
    { count: salesInvoices },
    { data: recentMigration },
  ] = await Promise.all([
    supabaseAdmin.from('cost_centers').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('vendors').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('purchase_orders').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('purchase_deliveries').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('purchase_invoices').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('sales_deliveries').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('sales_invoices').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('migration_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  // Total purchase invoices amount
  const { data: purchaseTotals } = await supabaseAdmin
    .from('purchase_invoices')
    .select('total')
    .not('total', 'is', null)

  const totalPurchases = purchaseTotals?.reduce((sum, row) => sum + (row.total || 0), 0) || 0

  const { data: salesTotals } = await supabaseAdmin
    .from('sales_invoices')
    .select('total')
    .not('total', 'is', null)

  const totalSales = salesTotals?.reduce((sum, row) => sum + (row.total || 0), 0) || 0

  return {
    costCenters: costCenters || 0,
    vendors: vendors || 0,
    purchaseOrders: purchaseOrders || 0,
    purchaseDeliveries: purchaseDeliveries || 0,
    purchaseInvoices: purchaseInvoices || 0,
    salesDeliveries: salesDeliveries || 0,
    salesInvoices: salesInvoices || 0,
    totalPurchases,
    totalSales,
    recentMigration,
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default async function DashboardPage() {
  const stats = await getStats()

  const statCards = [
    {
      label: 'Centros de Coste',
      value: stats.costCenters,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: 'Proveedores',
      value: stats.vendors,
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
      label: 'Pedidos de Compra',
      value: stats.purchaseOrders,
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
      value: stats.purchaseDeliveries,
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
      value: stats.purchaseInvoices,
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
      value: stats.salesDeliveries,
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
      value: stats.salesInvoices,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Panel de Control</h1>
        <p className="text-slate-500 mt-1">Resumen de tu actividad gastronómica</p>
        {stats.recentMigration && (
          <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
            stats.recentMigration.status === 'completed'
              ? 'bg-green-50 text-green-700'
              : stats.recentMigration.status === 'running'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-slate-50 text-slate-600'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              stats.recentMigration.status === 'completed' ? 'bg-green-500'
              : stats.recentMigration.status === 'running' ? 'bg-blue-500 animate-pulse'
              : 'bg-slate-400'
            }`} />
            Última migración: {stats.recentMigration.status === 'completed' ? 'Completada' : stats.recentMigration.status === 'running' ? 'En progreso' : stats.recentMigration.status}
            {stats.recentMigration.tspoonlab_email && ` · ${stats.recentMigration.tspoonlab_email}`}
          </div>
        )}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
      {stats.costCenters === 0 && (
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
