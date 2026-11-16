// Corregir y limpiar: facturas por revisar, albaranes de uno en uno, cabeceras,
// borrado de duplicados, fusión de proveedores y fecha del precio en el escandallo.
import { beforeEach, describe, expect, it } from 'vitest'
import { computeAlerts } from '@/server/services/alerts'
import { createIngredient, createSupplier, getSupplier, listSuppliers, recordPrice, updateIngredient, mergeSuppliers } from '@/server/services/catalog'
import {
  attachDeliveryNotes, createDeliveryNote, createInvoice, createOrder, deleteDeliveryNote, deleteInvoice, getDeliveryNote, getInvoice,
  listInvoices, setInvoicePaid, updateDeliveryNote, validateDeliveryNote,
} from '@/server/services/purchasing'
import { addLine, createRecipe, recipeCost } from '@/server/services/recipes'
import type { Ctx } from '@/server/http/context'
import { testCtx } from '../helpers'

let ctx: Ctx, makro: number, pollo: number
beforeEach(() => {
  ctx = testCtx()
  makro = createSupplier(ctx, { name: 'Makro', taxId: 'A28647451' }).id
  pollo = createIngredient(ctx, { name: 'Pollo', baseUnit: 'kg', cost: 6, supplierId: makro }).id
})
const validated = (number: string, date: string, base: number, supplierId = makro) => {
  const dn = createDeliveryNote(ctx, { supplierId, number, deliveryDate: date, base, lines: [{ ingredientId: pollo, description: 'Pollo', qty: base / 10, unit: 'kg', unitPrice: 10 }] })
  validateDeliveryNote(ctx, dn.id)
  return dn.id
}

describe('factura por revisar', () => {
  it('sin albaranes, a medias o completa; los albaranes se añaden de uno en uno', () => {
    const a = validated('A1', '2026-11-01', 30), b = validated('A2', '2026-11-03', 20)
    const inv = createInvoice(ctx, { supplierId: makro, number: 'F-1', invoiceDate: '2026-11-05', base: 50, vat: 5, total: 55 })
    expect(getInvoice(ctx, inv.id).review).toBe('Sin albaranes vinculados')
    attachDeliveryNotes(ctx, inv.id, [a])
    expect(getInvoice(ctx, inv.id).review).toBe('Los albaranes suman 30,00 € de 50,00 €')
    attachDeliveryNotes(ctx, inv.id, [b])
    expect(getInvoice(ctx, inv.id).review).toBeNull()
    expect(listInvoices(ctx)[0].review).toBeNull()
  })
  it('aparece como aviso con enlace al filtro', () => {
    createInvoice(ctx, { supplierId: makro, number: 'F-1', invoiceDate: '2026-11-05', base: 10, vat: 1, total: 11 })
    const al = computeAlerts(ctx, '2026-11-10').find(x => x.id === 'facturas_revisar')
    expect(al).toMatchObject({ titulo: '1 factura por revisar', href: '/dashboard/compras/facturas?filtro=revisar' })
  })
})

describe('albaranes: corregir y borrar', () => {
  it('la cabecera se corrige hasta validar, sin repetir número ni descuadrar', () => {
    const dn = createDeliveryNote(ctx, { supplierId: makro, number: 'X (dup 1)', deliveryDate: '2026-11-01', base: 10, vat: 1, total: 11 })
    createDeliveryNote(ctx, { supplierId: makro, number: 'OTRO', deliveryDate: '2026-11-01' })
    expect(updateDeliveryNote(ctx, dn.id, { number: 'X', deliveryDate: '02/11/2026' })).toMatchObject({ number: 'X', delivery_date: '2026-11-02', total_cents: 1100 })
    expect(() => updateDeliveryNote(ctx, dn.id, { number: 'OTRO' })).toThrow(/Ya existe el albarán OTRO/)
    expect(() => updateDeliveryNote(ctx, dn.id, { base: 10, vat: 1, total: 50 })).toThrow(/no cuadra/)
    expect(updateDeliveryNote(ctx, dn.id, { base: 20, vat: 2 })).toMatchObject({ base_cents: 2000, total_cents: 2200 })
    const v = validated('V1', '2026-11-01', 30)
    expect(() => updateDeliveryNote(ctx, v, { number: 'Z' })).toThrow(/validado/)
  })
  it('solo se borra lo que no se ha validado, con su imagen y rastro en auditoría', () => {
    ctx.db.prepare(`INSERT INTO document_images (org_id, mime, data, bytes) VALUES (?, 'image/png', 'data:image/png;base64,AA', 2)`).run(ctx.orgId)
    const dn = createDeliveryNote(ctx, { supplierId: makro, number: 'DUP', deliveryDate: '2026-11-01', imageId: 1, lines: [{ ingredientId: pollo, description: 'Pollo', qty: 1, unit: 'kg', unitPrice: 6 }] })
    deleteDeliveryNote(ctx, dn.id)
    expect(() => getDeliveryNote(ctx, dn.id)).toThrow(/no encontrado/)
    expect((ctx.db.prepare('SELECT COUNT(*) n FROM document_images').get() as any).n).toBe(0)
    expect((ctx.db.prepare(`SELECT COUNT(*) n FROM audit_log WHERE action = 'delete' AND entity = 'delivery_note'`).get() as any).n).toBe(1)
    const v = validated('V1', '2026-11-01', 30)
    expect(() => deleteDeliveryNote(ctx, v)).toThrow(/validado no se borra/)
  })
})

describe('facturas: borrar', () => {
  it('pagada o con albaranes no; pendiente y suelta sí', () => {
    const a = validated('A1', '2026-11-01', 30)
    const inv = createInvoice(ctx, { supplierId: makro, number: 'F-1', invoiceDate: '2026-11-05', base: 30, deliveryNoteIds: [a] })
    expect(() => deleteInvoice(ctx, inv.id)).toThrow(/agrupa albaranes/)
    const lone = createInvoice(ctx, { supplierId: makro, number: 'F-2', invoiceDate: '2026-11-05', base: 10, vat: 1, total: 11 })
    setInvoicePaid(ctx, lone.id, true)
    expect(() => deleteInvoice(ctx, lone.id)).toThrow(/pagada/)
    setInvoicePaid(ctx, lone.id, false)
    deleteInvoice(ctx, lone.id)
    expect(listInvoices(ctx).map(v => v.number)).toEqual(['F-1'])
  })
})

describe('fusionar proveedores', () => {
  it('lo mueve todo a una ficha, completa datos, deja rastro y borra la otra', () => {
    const typo = createSupplier(ctx, { name: 'Makro Distribución Mayorista, S.A.', taxId: 'A28647541', email: 'pedidos@makro.test' }).id
    const ing = createIngredient(ctx, { name: 'Tomate', baseUnit: 'kg', cost: 2, supplierId: typo }).id
    recordPrice(ctx, { ingredientId: ing, supplierId: typo, unitPrice: 2.1, observedOn: '2026-11-01', sourceType: 'manual', applyToIngredient: false })
    createOrder(ctx, { supplierId: typo, lines: [{ ingredientId: ing, qty: 1 }] })
    validated('T1', '2026-11-01', 30, typo)
    createInvoice(ctx, { supplierId: typo, number: 'FT-1', invoiceDate: '2026-11-05', base: 10, vat: 1, total: 11 })
    const kept = mergeSuppliers(ctx, makro, typo)
    expect(kept).toMatchObject({ id: makro, name: 'Makro', tax_id: 'A28647451', email: 'pedidos@makro.test' })
    expect(kept.notes).toMatch(/Antes también: Makro Distribución Mayorista, S\.A\. \(NIF A28647541\)/)
    expect(listSuppliers(ctx).map(s => s.id)).toEqual([makro])
    for (const t of ['ingredients', 'purchase_orders', 'delivery_notes', 'invoices', 'price_observations']) {
      expect((ctx.db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE supplier_id = ?`).get(typo) as any).n).toBe(0)
    }
    expect((ctx.db.prepare(`SELECT COUNT(*) n FROM audit_log WHERE action = 'merge'`).get() as any).n).toBe(1)
  })
  it('se niega si hay documentos con el mismo número en las dos fichas', () => {
    const typo = createSupplier(ctx, { name: 'Makro bis' }).id
    validated('A1', '2026-11-01', 30)
    createDeliveryNote(ctx, { supplierId: typo, number: 'A1', deliveryDate: '2026-11-01' })
    expect(() => mergeSuppliers(ctx, makro, typo)).toThrow(/albarán A1/)
    expect(getSupplier(ctx, typo).name).toBe('Makro bis')
    expect(() => mergeSuppliers(ctx, makro, makro)).toThrow(/distintos/)
  })
})

describe('escandallo: fecha del precio', () => {
  it('cada línea dice de cuándo es el precio que usa', () => {
    const r = createRecipe(ctx, { name: 'Pollo asado', portions: 2, salePrice: 10 }).id
    addLine(ctx, r, { ingredientId: pollo, qty: 1, unit: 'kg' })
    recordPrice(ctx, { ingredientId: pollo, supplierId: makro, unitPrice: 7, observedOn: '2026-11-03', sourceType: 'manual', applyToIngredient: true })
    expect(recipeCost(ctx, r).lines[0]).toMatchObject({ unitCost: 7, priceDate: '2026-11-03' })
    // Precio tecleado a mano en la ficha: la fecha es la del cambio.
    updateIngredient(ctx, pollo, { cost: 7.5 })
    expect(recipeCost(ctx, r).lines[0].priceDate).toBe(new Date().toISOString().slice(0, 10))
  })
})
