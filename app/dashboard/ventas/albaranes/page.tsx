'use client'
import CRUDPage, { F, type ColDef, type FieldDef } from '@/components/CRUDPage'
import { eur, fecha } from '@/lib/format'

const fields: FieldDef[] = [
  { key: 'number', label: 'Nº albarán' }, { key: 'customerName', label: 'Cliente' }, { key: 'customerType', label: 'Tipo de cliente' }, { key: 'customerTaxId', label: 'NIF' },
  { key: 'docDate', label: 'Fecha de entrega', type: 'date' }, { key: 'base', label: 'Base (€)', type: 'number' }, { key: 'vat', label: 'IVA (€)', type: 'number' }, { key: 'total', label: 'Total (€)', type: 'number' }, { key: 'notes', label: 'Notas' },
]
const columns: ColDef[] = [
  { label: 'Nº', render: r => r.number || '—' }, { label: 'Cliente', render: r => r.customer_name || '—' }, { label: 'Tipo', render: r => r.customer_type || '—' }, { label: 'NIF', render: r => r.customer_tax_id || '—' },
  { label: 'Fecha', render: r => fecha(r.doc_date) }, { label: 'Base', render: r => eur(r.base), right: true }, { label: 'Total', render: r => eur(r.total), right: true },
]
export default function AlbaranesVentaPage() {
  return <CRUDPage title="Albaranes de venta" eyebrow="Ventas" endpoint="/api/sales-documents" query="kind=delivery_note" fields={fields} columns={columns} singular="albarán de venta"
    fromRow={r => ({ number: r.number ?? '', customerName: r.customer_name ?? '', customerType: r.customer_type ?? '', customerTaxId: r.customer_tax_id ?? '', docDate: r.doc_date ?? '', base: String(r.base ?? ''), vat: String(r.vat ?? ''), total: String(r.total ?? ''), notes: r.notes ?? '' })}
    toBody={f => ({ kind: 'delivery_note', number: F.str(f.number), customerName: F.str(f.customerName), customerType: F.str(f.customerType), customerTaxId: F.str(f.customerTaxId), docDate: F.str(f.docDate), base: F.num(f.base), vat: F.num(f.vat), total: F.num(f.total), notes: F.str(f.notes) })} />
}
