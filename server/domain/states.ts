// Máquinas de estado de los documentos de compra. Una transición que no esté
// aquí no existe: el servicio lanza ConflictError y la BD no cambia.
import { ConflictError } from './errors'

export type OrderStatus = 'draft' | 'sent' | 'received' | 'closed' | 'cancelled'
export type DeliveryNoteStatus = 'draft' | 'review' | 'validated' | 'invoiced'
export type InvoiceStatus = 'pending' | 'paid'

const ORDER: Record<OrderStatus, OrderStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['received', 'cancelled'],
  received: ['closed'],
  closed: [],
  cancelled: [],
}

const DELIVERY_NOTE: Record<DeliveryNoteStatus, DeliveryNoteStatus[]> = {
  draft: ['review', 'validated'],
  review: ['draft', 'validated'],
  validated: ['invoiced', 'review'],
  invoiced: [],                       // se desfactura quitando la factura, no aquí
}

const INVOICE: Record<InvoiceStatus, InvoiceStatus[]> = {
  pending: ['paid'],
  paid: ['pending'],
}

function assertTransition<S extends string>(table: Record<S, S[]>, entity: string, from: S, to: S): void {
  if (from === to) return
  if (!table[from]?.includes(to)) {
    throw new ConflictError(`${entity}: no se puede pasar de "${from}" a "${to}"`, { from, to })
  }
}

export const assertOrderTransition = (from: OrderStatus, to: OrderStatus) => assertTransition(ORDER, 'Pedido', from, to)
export const assertDeliveryNoteTransition = (from: DeliveryNoteStatus, to: DeliveryNoteStatus) => assertTransition(DELIVERY_NOTE, 'Albarán', from, to)
export const assertInvoiceTransition = (from: InvoiceStatus, to: InvoiceStatus) => assertTransition(INVOICE, 'Factura', from, to)

export const isOrderEditable = (s: OrderStatus) => s === 'draft'
export const isDeliveryNoteEditable = (s: DeliveryNoteStatus) => s === 'draft' || s === 'review'
