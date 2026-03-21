import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  tspoonlabLogin,
  getCostCenters,
  getVendors,
  getPurchaseOrders,
  getPurchaseDeliveries,
  getPurchaseInvoices,
  getSalesDeliveries,
  getSalesInvoices,
  type CostCenter,
} from '@/lib/tspoonlab'

// Date range: last 3 years to now
function getDateRange() {
  const end = new Date()
  const start = new Date()
  start.setFullYear(start.getFullYear() - 3)
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

function extractId(item: Record<string, unknown>): string {
  return String(item.id || item._id || item.idOrder || item.idDelivery || item.idInvoice || Math.random())
}

function extractDate(item: Record<string, unknown>): string | null {
  const d = item.date || item.orderDate || item.deliveryDate || item.invoiceDate
  if (!d) return null
  return String(d).split('T')[0]
}

function extractTotal(item: Record<string, unknown>): number {
  const t = item.total || item.amount || item.totalAmount || 0
  return Number(t) || 0
}

function extractVendorId(item: Record<string, unknown>): string {
  return String(item.vendorId || item.idVendor || item.supplierId || '')
}

function extractVendorName(item: Record<string, unknown>): string {
  return String(item.vendorName || item.vendor || item.supplierName || '')
}

function extractStatus(item: Record<string, unknown>): string {
  return String(item.status || item.state || 'pending')
}

async function upsertBatch(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return 0
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    await supabaseAdmin.from(table).upsert(chunk, { onConflict: 'id' })
  }
  return rows.length
}

async function migrateCostCenter(token: string, center: CostCenter, dates: { startDate: string; endDate: string }) {
  const centerId = String(center.id)
  const stats = { vendors: 0, purchaseOrders: 0, purchaseDeliveries: 0, purchaseInvoices: 0, salesDeliveries: 0, salesInvoices: 0 }

  const vendors = await getVendors(token, centerId)
  stats.vendors = await upsertBatch('vendors', vendors.map((v) => ({
    id: String(v.id || v._id),
    cost_center_id: centerId,
    name: String(v.name || v.vendorName || ''),
    email: String(v.email || ''),
    phone: String(v.phone || v.telephone || ''),
    address: String(v.address || ''),
    raw_data: v,
    updated_at: new Date().toISOString(),
  })))

  const mapItem = (item: Record<string, unknown>, extra?: Record<string, unknown>) => ({
    id: extractId(item),
    cost_center_id: centerId,
    ...extra,
    date: extractDate(item),
    total: extractTotal(item),
    status: extractStatus(item),
    raw_data: item,
    updated_at: new Date().toISOString(),
  })

  const purchaseExtra = (item: Record<string, unknown>) => ({
    vendor_id: extractVendorId(item),
    vendor_name: extractVendorName(item),
  })

  const orders = await getPurchaseOrders(token, centerId, dates.startDate, dates.endDate)
  stats.purchaseOrders = await upsertBatch('purchase_orders', orders.map((o) => mapItem(o, purchaseExtra(o))))

  const deliveries = await getPurchaseDeliveries(token, centerId, dates.startDate, dates.endDate)
  stats.purchaseDeliveries = await upsertBatch('purchase_deliveries', deliveries.map((d) => mapItem(d, purchaseExtra(d))))

  const invoices = await getPurchaseInvoices(token, centerId, dates.startDate, dates.endDate)
  stats.purchaseInvoices = await upsertBatch('purchase_invoices', invoices.map((inv) => mapItem(inv, purchaseExtra(inv))))

  const salesDels = await getSalesDeliveries(token, centerId, dates.startDate, dates.endDate)
  stats.salesDeliveries = await upsertBatch('sales_deliveries', salesDels.map((d) => mapItem(d)))

  const salesInvs = await getSalesInvoices(token, centerId, dates.startDate, dates.endDate)
  stats.salesInvoices = await upsertBatch('sales_invoices', salesInvs.map((inv) => mapItem(inv)))

  return stats
}

// Run migration synchronously and return result directly
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
    }

    const dates = getDateRange()
    const details: Record<string, unknown> = {}

    // 1. Login
    const token = await tspoonlabLogin(email, password)
    details.loginSuccess = true

    // 2. Get cost centers
    const costCenters = await getCostCenters(token)
    details.costCentersFound = costCenters.length

    // 3. Save cost centers
    await upsertBatch('cost_centers', costCenters.map((c) => ({
      id: String(c.id),
      name: String(c.name || c.description || c.label || `Centro ${c.id}`),
      raw_data: c,
      updated_at: new Date().toISOString(),
    })))

    // 4. Migrate each cost center
    details.centers = {}
    for (const center of costCenters) {
      const stats = await migrateCostCenter(token, center, dates)
      ;(details.centers as Record<string, unknown>)[String(center.id)] = { name: center.name, ...stats }
    }

    // 5. Save migration log
    await supabaseAdmin.from('migration_logs').insert({
      tspoonlab_email: email,
      status: 'completed',
      completed_at: new Date().toISOString(),
      details,
    })

    return NextResponse.json({ success: true, details })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
