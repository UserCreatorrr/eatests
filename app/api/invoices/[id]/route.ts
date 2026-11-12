import { route } from '@/server/http/route'
import { getInvoice, unbilledDeliveryNotes } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx, params }) => {
  const invoice = getInvoice(ctx, Number(params.id))
  const image = invoice.image_id ? ctx.db.prepare('SELECT mime, data FROM document_images WHERE org_id = ? AND id = ?').get(ctx.orgId, invoice.image_id) : null
  // Candidatos: albaranes validados del proveedor que aún no están en ninguna factura.
  return { ...invoice, image, candidates: unbilledDeliveryNotes(ctx, invoice.supplier_id) }
})
