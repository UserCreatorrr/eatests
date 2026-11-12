import { route } from '@/server/http/route'
import { deactivateSupplier, getSupplier, supplierSchema, updateSupplier } from '@/server/services/catalog'
import { listDeliveryNotes, listInvoices, listOrders } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

// Ficha del proveedor: datos, ingredientes que le compramos y sus documentos.
export const GET = route({}, ({ ctx, params }) => {
  const id = Number(params.id)
  const supplier = getSupplier(ctx, id)
  const ingredients = ctx.db.prepare('SELECT id, name, base_unit, cost, vat_rate, warehouse_id FROM ingredients WHERE org_id = ? AND supplier_id = ? AND active = 1 ORDER BY name').all(ctx.orgId, id)
  const invoices = listInvoices(ctx, { supplierId: id })
  const deliveryNotes = listDeliveryNotes(ctx, { supplierId: id })
  const orders = listOrders(ctx).filter(o => o.supplier_id === id)
  const prices = ctx.db.prepare(`SELECT p.ingredient_id, i.name, p.unit_price, p.previous_price, p.observed_on FROM price_observations p JOIN ingredients i ON i.id = p.ingredient_id
                                 WHERE p.org_id = ? AND p.supplier_id = ? ORDER BY p.observed_on DESC, p.id DESC LIMIT 20`).all(ctx.orgId, id)
  // Gasto = facturas. Sin ellas, albaranes validados. Nunca los dos sumados.
  const spendInvoices = invoices.reduce((s, v) => s + v.total_cents, 0)
  const spendNotes = deliveryNotes.filter(d => d.status !== 'draft').reduce((s, d) => s + d.total_cents, 0)
  return { supplier, ingredients, invoices, deliveryNotes, orders, prices,
           totals: { spend_cents: spendInvoices > 0 ? spendInvoices : spendNotes, invoices_cents: spendInvoices, delivery_notes_cents: spendNotes,
                     pending_cents: invoices.filter(v => v.status === 'pending').reduce((s, v) => s + v.total_cents, 0) } }
})

export const PATCH = route({ body: supplierSchema.partial() }, ({ ctx, params, body }) => updateSupplier(ctx, Number(params.id), body))

export const DELETE = route({}, ({ ctx, params }) => { deactivateSupplier(ctx, Number(params.id)); return { ok: true } })
