import { route } from '@/server/http/route'
import { deleteDeliveryNote, deliveryNoteHeaderSchema, getDeliveryNote, updateDeliveryNote } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx, params }) => {
  const note = getDeliveryNote(ctx, Number(params.id))
  const image = note.image_id ? ctx.db.prepare('SELECT mime, data FROM document_images WHERE org_id = ? AND id = ?').get(ctx.orgId, note.image_id) : null
  const prices = ctx.db.prepare(`SELECT p.ingredient_id, i.name, p.previous_price, p.unit_price, p.observed_on FROM price_observations p JOIN ingredients i ON i.id = p.ingredient_id
                                 WHERE p.org_id = ? AND p.source_type = 'delivery_note' AND p.source_id = ? ORDER BY p.id`).all(ctx.orgId, note.id)
  const movements = ctx.db.prepare(`SELECT m.ingredient_id, i.name, m.qty, i.base_unit, m.warehouse_id FROM stock_movements m JOIN ingredients i ON i.id = m.ingredient_id
                                    WHERE m.org_id = ? AND m.source_type = 'delivery_note' AND m.source_id = ?`).all(ctx.orgId, note.id)
  return { ...note, image, impact: { prices, movements } }
})

// Corregir cabecera (número, fecha, importes) mientras no esté validado.
export const PATCH = route({ body: deliveryNoteHeaderSchema }, ({ ctx, params, body }) => updateDeliveryNote(ctx, Number(params.id), body))

// Solo albaranes sin validar: los validados ya movieron precios y stock.
export const DELETE = route({}, ({ ctx, params }) => { deleteDeliveryNote(ctx, Number(params.id)); return { ok: true } })
