// El ciclo completo de compra que pide el diagnóstico del 24-sep, con los
// criterios de aceptación de Steven convertidos en tests.
import { beforeEach, describe, expect, it } from 'vitest'
import { ConflictError, ValidationError } from '@/server/domain/errors'
import type { Ctx } from '@/server/http/context'
import { createIngredient, createSupplier, getIngredient, priceHistory } from '@/server/services/catalog'
import {
  addDeliveryNoteLine, attachDeliveryNotes, createDeliveryNote, createInvoice, createOrder, detachDeliveryNote, getDeliveryNote, getInvoice, getOrder,
  receiveOrder, removeDeliveryNoteLine, setInvoicePaid, setOrderStatus, unbilledDeliveryNotes, validateDeliveryNote,
} from '@/server/services/purchasing'
import { stockLevels } from '@/server/services/stock'
import { testCtx } from '../helpers'

let ctx: Ctx, makro: number, pechuga: number
beforeEach(() => {
  ctx = testCtx()
  makro = createSupplier(ctx, { name: 'Makro', taxId: 'A28647451' }).id
  pechuga = createIngredient(ctx, { name: 'Pechuga de pollo', baseUnit: 'kg', cost: 6.2, supplierId: makro }).id
})

describe('pedido', () => {
  it('se crea en borrador, calcula el total con el precio actual y sigue la máquina de estados', () => {
    const o = createOrder(ctx, { supplierId: makro, lines: [{ ingredientId: pechuga, qty: 5 }] })
    expect(o.status).toBe('draft')
    expect(o.number).toMatch(/^PED-\d{8}-001$/)
    expect(o.lines[0]).toMatchObject({ unit: 'kg', unit_cost_estimate: 6.2, line_total: 31 })
    // Sube el precio: el pedido abierto refleja el precio actual (bug #4 del 24-sep)
    ctx.db.prepare('UPDATE ingredients SET cost = 8.5 WHERE id = ?').run(pechuga)
    expect(getOrder(ctx, o.id).total).toBe(42.5)
    expect(() => setOrderStatus(ctx, o.id, 'closed')).toThrow(ConflictError)
    setOrderStatus(ctx, o.id, 'sent', { sentVia: 'whatsapp' })
    expect(getOrder(ctx, o.id).sent_via).toBe('whatsapp')
  })
  it('no se envía sin líneas ni admite unidades de otra magnitud', () => {
    const o = createOrder(ctx, { supplierId: makro })
    expect(() => setOrderStatus(ctx, o.id, 'sent')).toThrow(/sin líneas/)
    expect(() => createOrder(ctx, { supplierId: makro, lines: [{ ingredientId: pechuga, qty: 2, unit: 'l' }] })).toThrow(/se compra en kg/)
  })
  it('recibir el pedido crea el albarán con las líneas rellenas (criterio P3)', () => {
    const o = createOrder(ctx, { supplierId: makro, lines: [{ ingredientId: pechuga, qty: 5 }] })
    setOrderStatus(ctx, o.id, 'sent')
    const dn = receiveOrder(ctx, o.id, { number: 'ALB-20260814-001' })
    expect(dn.status).toBe('draft')
    expect(dn.purchase_order_id).toBe(o.id)
    expect(dn.lines).toHaveLength(1)
    expect(dn.lines[0]).toMatchObject({ ingredient_id: pechuga, qty: 5, unit: 'kg', unit_price: 6.2 })
    expect(getOrder(ctx, o.id).status).toBe('received')
    expect(() => receiveOrder(ctx, o.id)).toThrow(ConflictError)
  })
})

describe('albarán', () => {
  it('no admite duplicado por proveedor + número (criterio P2)', () => {
    createDeliveryNote(ctx, { supplierId: makro, number: 'ALB-QA-003', deliveryDate: '2026-08-15' })
    expect(() => createDeliveryNote(ctx, { supplierId: makro, number: 'ALB-QA-003', deliveryDate: '2026-08-16' })).toThrow(ConflictError)
    // Mismo NIF con otro nombre: mismo proveedor, mismo duplicado
    expect(() => createDeliveryNote(ctx, { supplierName: 'Makro Distribución SA', supplierTaxId: 'a-28647451', number: 'ALB-QA-003' })).toThrow(/Ya existe el albarán/)
    expect(ctx.db.prepare('SELECT COUNT(*) c FROM suppliers').get()).toEqual({ c: 1 })
  })
  it('no se valida sin líneas, sin mapear, ni si no cuadra con la base (criterio P3)', () => {
    const dn = createDeliveryNote(ctx, { supplierId: makro, number: 'A1', base: 31 })
    expect(() => validateDeliveryNote(ctx, dn.id)).toThrow(/no tiene líneas/)
    addDeliveryNoteLine(ctx, dn.id, { description: 'Pechuga', qty: 5, unit: 'kg', unitPrice: 6.2 })
    expect(() => validateDeliveryNote(ctx, dn.id)).toThrow(/sin asignar/)
    const [line] = getDeliveryNote(ctx, dn.id).lines
    removeDeliveryNoteLine(ctx, dn.id, line.id)
    addDeliveryNoteLine(ctx, dn.id, { ingredientId: pechuga, description: 'Pechuga', qty: 5, unit: 'kg', unitPrice: 8.5 })
    expect(() => validateDeliveryNote(ctx, dn.id)).toThrow(/no cuadra con la base/)
    expect(getDeliveryNote(ctx, dn.id).status).toBe('draft')
  })
  it('al validar: precios, histórico, stock y recetas afectadas, todo o nada (criterio P4)', () => {
    ctx.db.prepare(`INSERT INTO recipes (org_id, name) VALUES (?, 'Pollo al limón')`).run(ctx.orgId)
    ctx.db.prepare(`INSERT INTO recipe_lines (org_id, recipe_id, ingredient_id, qty, unit) VALUES (?, 1, ?, 2000, 'g')`).run(ctx.orgId, pechuga)
    const dn = createDeliveryNote(ctx, { supplierId: makro, number: 'A1', deliveryDate: '2026-08-15', base: 42.5,
      lines: [{ ingredientId: pechuga, description: 'Pechuga pollo', qty: 5, unit: 'kg', unitPrice: 8.5, vatRate: 10 }] })
    const r = validateDeliveryNote(ctx, dn.id)
    expect(r.note.status).toBe('validated')
    expect(r.priceChanges).toEqual([{ ingredientId: pechuga, name: 'Pechuga de pollo', previous: 6.2, current: 8.5, changedPct: 37.1 }])
    expect(r.affectedRecipes).toEqual([{ id: 1, name: 'Pollo al limón' }])
    expect(getIngredient(ctx, pechuga)).toMatchObject({ cost: 8.5, vat_rate: 10 })
    expect(priceHistory(ctx, pechuga)[0]).toMatchObject({ unit_price: 8.5, previous_price: 6.2, source_type: 'delivery_note', source_id: dn.id })
    // Nevera muestra 5 kg y 42,50 € (criterio de aceptación de la pág. 8)
    expect(stockLevels(ctx, { ingredientId: pechuga })[0]).toMatchObject({ qty: 5, value: 42.5, base_unit: 'kg' })
    // Validado = bloqueado
    expect(() => addDeliveryNoteLine(ctx, dn.id, { description: 'x', qty: 1, unit: 'kg' })).toThrow(/validado/)
    expect(() => validateDeliveryNote(ctx, dn.id)).toThrow(ConflictError)
  })
  it('convierte la unidad de la línea a la base del ingrediente (g en línea, kg en catálogo)', () => {
    const dn = createDeliveryNote(ctx, { supplierId: makro, number: 'A2', lines: [{ ingredientId: pechuga, description: 'Pechuga', qty: 2500, unit: 'g', unitPrice: 0.0085 }] })
    validateDeliveryNote(ctx, dn.id)
    expect(getIngredient(ctx, pechuga).cost).toBe(8.5)
    expect(stockLevels(ctx, { ingredientId: pechuga })[0].qty).toBe(2.5)
  })
})

describe('factura', () => {
  function validatedNote(number: string, date: string, base: number) {
    const dn = createDeliveryNote(ctx, { supplierId: makro, number, deliveryDate: date, base, lines: [{ ingredientId: pechuga, description: 'P', qty: base / 8.5, unit: 'kg', unitPrice: 8.5 }] })
    return validateDeliveryNote(ctx, dn.id).note
  }
  it('agrupa albaranes validados del proveedor y cuadra con ellos (criterio P2)', () => {
    const a = validatedNote('A1', '2026-08-13', 42.5)
    const b = validatedNote('A2', '2026-08-14', 17)
    expect(unbilledDeliveryNotes(ctx, makro).map(d => d.number)).toEqual(['A2', 'A1'])
    const inv = createInvoice(ctx, { supplierId: makro, number: 'F-1', invoiceDate: '2026-08-31', base: 59.5, vat: 5.95, total: 65.45, deliveryNoteIds: [a.id, b.id] })
    expect(inv.delivery_note_count).toBe(2)
    expect(inv.deliveryNotes.every(d => d.status === 'invoiced')).toBe(true)
    expect(unbilledDeliveryNotes(ctx, makro)).toEqual([])
    // Un albarán solo puede estar en una factura
    expect(() => createInvoice(ctx, { supplierId: makro, number: 'F-2', invoiceDate: '2026-09-01', base: 42.5, deliveryNoteIds: [a.id] })).toThrow(/ya está en otra factura/)
    detachDeliveryNote(ctx, inv.id, b.id)
    expect(getDeliveryNote(ctx, b.id).status).toBe('validated')
  })
  it('rechaza duplicados, cuadres imposibles y fechas incoherentes (bugs #2 y #9)', () => {
    validatedNote('A1', '2026-08-15', 42.5)
    expect(() => createInvoice(ctx, { supplierId: makro, number: 'F-1', invoiceDate: '2026-08-31', base: 100, vat: 21, total: 150 })).toThrow(/no cuadra con el total/)
    expect(() => createInvoice(ctx, { supplierId: makro, number: 'F-1', invoiceDate: '2026-08-31', dueDate: '2026-08-01' })).toThrow(/vencimiento/)
    createInvoice(ctx, { supplierId: makro, number: 'F-1', invoiceDate: '2026-08-31' })
    expect(() => createInvoice(ctx, { supplierId: makro, number: 'F-1', invoiceDate: '2026-09-30' })).toThrow(ConflictError)
    // Factura anterior a su albarán
    const inv = createInvoice(ctx, { supplierId: makro, number: 'F-2', invoiceDate: '2026-08-13' })
    const [a] = unbilledDeliveryNotes(ctx, makro)
    expect(() => attachDeliveryNotes(ctx, inv.id, [a.id])).toThrow(ValidationError)
  })
  it('un albarán no se cuela en la factura de otro proveedor ni puede superar su base', () => {
    const otro = createSupplier(ctx, { name: 'Prodesco' }).id
    const a = validatedNote('A1', '2026-08-13', 42.5)
    const inv = createInvoice(ctx, { supplierId: otro, number: 'F-1', invoiceDate: '2026-08-31' })
    expect(() => attachDeliveryNotes(ctx, inv.id, [a.id])).toThrow(/otro proveedor/)
    const inv2 = createInvoice(ctx, { supplierId: makro, number: 'F-9', invoiceDate: '2026-08-31', base: 30 })
    expect(() => attachDeliveryNotes(ctx, inv2.id, [a.id])).toThrow(/superan la base de la factura/)
    expect(getDeliveryNote(ctx, a.id).status).toBe('validated')   // la transacción deshizo el enlace
  })
  it('pagar y despagar', () => {
    const inv = createInvoice(ctx, { supplierId: makro, number: 'F-1', invoiceDate: '2026-08-31', base: 10, vat: 1, total: 11 })
    expect(setInvoicePaid(ctx, inv.id, true, '2026-09-05')).toMatchObject({ status: 'paid', paid_on: '2026-09-05' })
    expect(setInvoicePaid(ctx, inv.id, false)).toMatchObject({ status: 'pending', paid_on: null })
    expect(getInvoice(ctx, inv.id).status).toBe('pending')
  })
})
