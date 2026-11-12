'use client'
import CRUDPage, { F, type ColDef, type FieldDef } from '@/components/CRUDPage'
import { Badge } from '@/components/ui'
import { eur, fecha } from '@/lib/format'

const fields: FieldDef[] = [
  { key: 'number', label: 'Nº factura' }, { key: 'customerName', label: 'Cliente' }, { key: 'customerTaxId', label: 'NIF' }, { key: 'customerType', label: 'Tipo de cliente' },
  { key: 'docDate', label: 'Fecha', type: 'date' }, { key: 'dueDate', label: 'Vencimiento', type: 'date' }, { key: 'base', label: 'Base (€)', type: 'number' }, { key: 'vat', label: 'IVA (€)', type: 'number' }, { key: 'total', label: 'Total (€)', type: 'number' },
  { key: 'paid', label: 'Cobrada', type: 'checkbox' }, { key: 'notes', label: 'Notas' },
]
const columns: ColDef[] = [
  { label: 'Nº', render: r => r.number || '—' }, { label: 'Cliente', render: r => r.customer_name || '—' }, { label: 'NIF', render: r => r.customer_tax_id || '—' },
  { label: 'Fecha', render: r => fecha(r.doc_date) }, { label: 'Vence', render: r => fecha(r.due_date) }, { label: 'Base', render: r => eur(r.base), right: true }, { label: 'IVA', render: r => eur(r.vat), right: true }, { label: 'Total', render: r => eur(r.total), right: true },
  { label: 'Cobro', render: r => <Badge tone={r.paid ? 'ok' : 'warn'}>{r.paid ? 'Cobrada' : 'Pendiente'}</Badge> },
]
export default function FacturasVentaPage() {
  return <CRUDPage title="Facturas de venta" eyebrow="Ventas" endpoint="/api/sales-documents" query="kind=invoice" fields={fields} columns={columns} singular="factura de venta"
    fromRow={r => ({ number: r.number ?? '', customerName: r.customer_name ?? '', customerTaxId: r.customer_tax_id ?? '', customerType: r.customer_type ?? '', docDate: r.doc_date ?? '', dueDate: r.due_date ?? '', base: String(r.base ?? ''), vat: String(r.vat ?? ''), total: String(r.total ?? ''), paid: r.paid ? '1' : '0', notes: r.notes ?? '' })}
    toBody={f => ({ kind: 'invoice', number: F.str(f.number), customerName: F.str(f.customerName), customerTaxId: F.str(f.customerTaxId), customerType: F.str(f.customerType), docDate: F.str(f.docDate), dueDate: F.str(f.dueDate), base: F.num(f.base), vat: F.num(f.vat), total: F.num(f.total), paid: F.bool(f.paid), notes: F.str(f.notes) })} />
}
