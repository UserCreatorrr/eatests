// Documentos de venta (albaranes y facturas emitidas). Registro simple:
// sirven para el histórico y el daily brief, no llevan líneas.
import { z } from 'zod'
import { parseDate } from '@/server/domain/dates'
import { NotFoundError, ValidationError } from '@/server/domain/errors'
import { amountsReconcile, fromCents, toCents } from '@/server/domain/money'
import type { Ctx } from '@/server/http/context'

export const salesDocSchema = z.object({
  kind: z.enum(['delivery_note', 'invoice']),
  number: z.string().trim().max(60).optional().nullable(),
  customerName: z.string().trim().max(160).optional().nullable(),
  customerType: z.string().trim().max(60).optional().nullable(),
  customerTaxId: z.string().trim().max(40).optional().nullable(),
  docDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  base: z.number().min(0).optional().nullable(),
  vat: z.number().min(0).optional().nullable(),
  total: z.number().min(0).optional().nullable(),
  paid: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export interface SalesDoc { id: number; kind: 'delivery_note' | 'invoice'; number: string | null; customer_name: string | null; customer_type: string | null; customer_tax_id: string | null; doc_date: string | null; due_date: string | null; base: number; vat: number; total: number; paid: number; notes: string | null }

const SEL = 'SELECT id, kind, number, customer_name, customer_type, customer_tax_id, doc_date, due_date, base_cents, vat_cents, total_cents, paid, notes FROM sales_documents'
const map = (r: any): SalesDoc => ({ ...r, base: fromCents(r.base_cents), vat: fromCents(r.vat_cents), total: fromCents(r.total_cents), base_cents: undefined, vat_cents: undefined, total_cents: undefined })

export function listSalesDocs(ctx: Ctx, kind?: 'delivery_note' | 'invoice'): SalesDoc[] {
  const rows = kind ? ctx.db.prepare(`${SEL} WHERE org_id = ? AND kind = ? ORDER BY doc_date DESC, id DESC`).all(ctx.orgId, kind) : ctx.db.prepare(`${SEL} WHERE org_id = ? ORDER BY doc_date DESC, id DESC`).all(ctx.orgId)
  return (rows as any[]).map(map)
}

function amounts(d: { base?: number | null; vat?: number | null; total?: number | null }) {
  const base = toCents(d.base ?? 0), vat = toCents(d.vat ?? 0)
  const total = d.total != null ? toCents(d.total) : base + vat
  if (d.total != null && (d.base != null || d.vat != null) && !amountsReconcile(base, vat, total)) throw new ValidationError('Base + IVA no cuadra con el total')
  return { base, vat, total }
}

export function createSalesDoc(ctx: Ctx, input: unknown): SalesDoc {
  const d = salesDocSchema.parse(input)
  const docDate = d.docDate ? parseDate(d.docDate) : null, dueDate = d.dueDate ? parseDate(d.dueDate) : null
  if ((d.docDate && !docDate) || (d.dueDate && !dueDate)) throw new ValidationError('Fecha no válida')
  const a = amounts(d)
  const r = ctx.db.prepare('INSERT INTO sales_documents (org_id, kind, number, customer_name, customer_type, customer_tax_id, doc_date, due_date, base_cents, vat_cents, total_cents, paid, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(ctx.orgId, d.kind, d.number || null, d.customerName || null, d.customerType || null, d.customerTaxId || null, docDate, dueDate, a.base, a.vat, a.total, d.paid ? 1 : 0, d.notes || null)
  return map(ctx.db.prepare(`${SEL} WHERE id = ?`).get(r.lastInsertRowid))
}

export function updateSalesDoc(ctx: Ctx, id: number, input: unknown): SalesDoc {
  const cur = ctx.db.prepare(`${SEL} WHERE org_id = ? AND id = ?`).get(ctx.orgId, id) as any
  if (!cur) throw new NotFoundError('Documento no encontrado')
  const p = salesDocSchema.partial().parse(input)
  const merged = { kind: cur.kind, number: p.number !== undefined ? p.number : cur.number, customerName: p.customerName !== undefined ? p.customerName : cur.customer_name, customerType: p.customerType !== undefined ? p.customerType : cur.customer_type,
    customerTaxId: p.customerTaxId !== undefined ? p.customerTaxId : cur.customer_tax_id, docDate: p.docDate !== undefined ? p.docDate : cur.doc_date, dueDate: p.dueDate !== undefined ? p.dueDate : cur.due_date,
    base: p.base !== undefined ? p.base : fromCents(cur.base_cents), vat: p.vat !== undefined ? p.vat : fromCents(cur.vat_cents), total: p.total !== undefined ? p.total : fromCents(cur.total_cents), paid: p.paid !== undefined ? p.paid : !!cur.paid, notes: p.notes !== undefined ? p.notes : cur.notes }
  const d = salesDocSchema.parse(merged)
  const docDate = d.docDate ? parseDate(d.docDate) : null, dueDate = d.dueDate ? parseDate(d.dueDate) : null
  if ((d.docDate && !docDate) || (d.dueDate && !dueDate)) throw new ValidationError('Fecha no válida')
  const a = amounts(d)
  ctx.db.prepare('UPDATE sales_documents SET number = ?, customer_name = ?, customer_type = ?, customer_tax_id = ?, doc_date = ?, due_date = ?, base_cents = ?, vat_cents = ?, total_cents = ?, paid = ?, notes = ? WHERE org_id = ? AND id = ?')
    .run(d.number || null, d.customerName || null, d.customerType || null, d.customerTaxId || null, docDate, dueDate, a.base, a.vat, a.total, d.paid ? 1 : 0, d.notes || null, ctx.orgId, id)
  return map(ctx.db.prepare(`${SEL} WHERE id = ?`).get(id))
}

export function removeSalesDoc(ctx: Ctx, id: number): void {
  const r = ctx.db.prepare('DELETE FROM sales_documents WHERE org_id = ? AND id = ?').run(ctx.orgId, id)
  if (!r.changes) throw new NotFoundError('Documento no encontrado')
}
