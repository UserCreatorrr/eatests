import { beforeEach, describe, expect, it } from 'vitest'
import { createIngredient, createSupplier, getIngredient, listSuppliers } from '@/server/services/catalog'
import { commitDocument, mapExtracted, scanDocument } from '@/server/services/documents'
import { getDeliveryNote, getInvoice, listInvoices } from '@/server/services/purchasing'
import { stockLevels } from '@/server/services/stock'
import type { Ctx } from '@/server/http/context'
import { testCtx } from '../helpers'

let ctx: Ctx
beforeEach(() => {
  ctx = testCtx()
  createSupplier(ctx, { name: 'Makro', taxId: 'A28647451' })
  createIngredient(ctx, { name: 'Pechuga de pollo', baseUnit: 'kg', cost: 6, vatRate: 10 })
  createIngredient(ctx, { name: 'Tomate', baseUnit: 'kg', cost: 2 })
})

const RAW = { vendor: 'MAKRO SA', vendor_nif: 'a-28647451', doc_num: 'ALB-77', fecha: '2026-11-10', base: 70, iva: 7, total: 77,
  lineas: [{ nombre: 'Pechuga pollo', cantidad: 5000, unidad: 'g', precio_unitario: 0.0075, total_linea: 37.5, iva_pct: 10 }, { nombre: 'Tomate pera', cantidad: 10, unidad: 'kg', precio_unitario: 2.5, total_linea: 25 },
           { nombre: 'Aceite de oliva', cantidad: 5, unidad: 'l', precio_unitario: 1.5, total_linea: 7.5 }, { nombre: 'Sal', cantidad: 1, unidad: 'saco', precio_unitario: 1, total_linea: 1 }] }

describe('escaneo', () => {
  it('cruza proveedor por NIF, líneas por nombre y normaliza el precio a la unidad base', async () => {
    const r = await scanDocument(ctx, { image: 'data:image/jpeg;base64,' + 'x'.repeat(60), kind: 'delivery_note' }, async () => RAW)
    expect(r.header).toMatchObject({ supplierName: 'Makro', vendorTaxId: 'A28647451', number: 'ALB-77', date: '2026-11-10' })
    expect(r.lines[0]).toMatchObject({ ingredientName: 'Pechuga de pollo', match: 'partial', unitPriceInBase: 7.5, changePct: 25, vatRate: 10 })
    expect(r.lines[1]).toMatchObject({ ingredientName: 'Tomate', unitPriceInBase: 2.5, changePct: 25 })
    expect(r.lines[2]).toMatchObject({ ingredientId: null, unitRecognized: true })
    expect(r.lines[3]).toMatchObject({ ingredientId: null, unitRecognized: false })
    expect(r.reconcile).toMatchObject({ linesSum: 71, gap: 0 })
    expect(r.warnings).toMatchObject({ unmapped: 2, priceChanges: 2, newSupplier: false, gap: false })
  })
  it('unidad incompatible con el ingrediente se marca y no se compara el precio', () => {
    const r = mapExtracted(ctx, 'delivery_note', { vendor: 'Nuevo', lineas: [{ nombre: 'Tomate', cantidad: 2, unidad: 'l', precio_unitario: 3 }] })
    expect(r.lines[0]).toMatchObject({ ingredientName: 'Tomate', unitMismatch: true, changePct: null })
    expect(r.warnings.newSupplier).toBe(true)
  })
})

describe('commit', () => {
  const scanToCommit = (r: ReturnType<typeof mapExtracted>, extra: any = {}) => ({
    kind: r.kind, header: { supplierId: r.header.supplierId, vendor: r.header.vendor, vendorTaxId: r.header.vendorTaxId, number: r.header.number, date: r.header.date, dueDate: r.header.dueDate, base: r.header.base, vat: r.header.vat, total: r.header.total },
    lines: r.lines.map(l => ({ description: l.description, qty: l.qty, unit: l.unitRecognized ? l.unit : null, unitPrice: l.unitPrice, lineTotal: l.lineTotal, vatRate: l.vatRate, ingredientId: l.ingredientId })), ...extra,
  })
  it('albarán con todo mapeado: se valida, actualiza precios, entra stock y guarda la imagen', () => {
    const r = mapExtracted(ctx, 'delivery_note', { ...RAW, base: 62.5, iva: 6.25, total: 68.75, lineas: RAW.lineas.slice(0, 2) })
    const c = commitDocument(ctx, { ...scanToCommit(r), image: 'data:image/png;base64,' + 'A'.repeat(400) })
    expect(c).toMatchObject({ status: 'validated', number: 'ALB-77', lines: 2, pendingLines: 0 })
    expect(c.validation!.priceChanges.map(p => p.current)).toEqual([7.5, 2.5])
    expect(getIngredient(ctx, 1).cost).toBe(7.5)
    expect(stockLevels(ctx, { ingredientId: 1 })[0].qty).toBe(5)
    expect(getDeliveryNote(ctx, c.deliveryNoteId!).image_id).not.toBeNull()
    expect((ctx.db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE org_id = ?').get(ctx.orgId) as any).c).toBe(1)
  })
  it('líneas sin resolver: queda en revisión y avisa; crear ingrediente desde la validación lo resuelve', () => {
    const r = mapExtracted(ctx, 'delivery_note', { ...RAW, lineas: RAW.lineas.slice(0, 3), base: 70, iva: 7, total: 77 })
    const c1 = commitDocument(ctx, scanToCommit(r))
    expect(c1).toMatchObject({ status: 'review', pendingLines: 1, validation: null })
    const r2 = mapExtracted(ctx, 'delivery_note', { ...RAW, doc_num: 'ALB-78', lineas: RAW.lineas.slice(0, 3), base: 70, iva: 7, total: 77 })
    const payload = scanToCommit(r2)
    payload.lines[2].ingredientId = null; (payload.lines[2] as any).create = { category: 'Aceites', vatRate: 10 }
    const c2 = commitDocument(ctx, payload)
    expect(c2).toMatchObject({ status: 'validated', ingredientsCreated: 1, pendingLines: 0 })
    const aceite = getIngredient(ctx, 3)
    expect(aceite).toMatchObject({ name: 'Aceite de oliva', base_unit: 'l', cost: 1.5, category: 'Aceites', supplier_id: 1 })
  })
  it('factura escaneada nace como albarán validado + factura que lo agrupa; duplicada se rechaza', () => {
    const r = mapExtracted(ctx, 'invoice', { ...RAW, doc_num: 'F-2026-9', fecha_vencimiento: '2026-12-10', base: 62.5, iva: 6.25, total: 68.75, lineas: RAW.lineas.slice(0, 2) })
    const c = commitDocument(ctx, scanToCommit(r))
    expect(c).toMatchObject({ kind: 'invoice', status: 'validated', number: 'F-2026-9' })
    const inv = getInvoice(ctx, c.invoiceId!)
    expect(inv.deliveryNotes).toHaveLength(1)
    expect(inv.deliveryNotes[0].status).toBe('invoiced')
    expect(inv.due_date).toBe('2026-12-10')
    expect(() => commitDocument(ctx, scanToCommit(r))).toThrow()
    expect(listInvoices(ctx)).toHaveLength(1)
  })
  it('proveedor desconocido: error claro, o alta si se pide', () => {
    const r = mapExtracted(ctx, 'delivery_note', { vendor: 'Lonja Nueva', lineas: [{ nombre: 'Tomate', cantidad: 1, unidad: 'kg', precio_unitario: 2 }], base: 2 })
    expect(() => commitDocument(ctx, scanToCommit(r))).toThrow(/Elige el proveedor/)
    const c = commitDocument(ctx, scanToCommit(r, { createSupplier: true }))
    expect(c.status).toBe('validated')
    expect(listSuppliers(ctx).map(s => s.name)).toContain('Lonja Nueva')
  })
})
