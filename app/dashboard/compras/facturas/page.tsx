'use client'

import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'invoiceNum', label: 'Nº Factura' },
  { key: 'documentNum', label: 'Nº Documento' },
  { key: 'vendor', label: 'Proveedor' },
  { key: 'codeVendor', label: 'Cod. Proveedor' },
  { key: 'nif', label: 'NIF' },
  { key: 'accountVendor', label: 'Cuenta proveedor' },
  { key: 'date', label: 'Fecha (timestamp ms)', type: 'number' },
  { key: 'dateAccounting', label: 'Fecha contable (timestamp ms)', type: 'number' },
  { key: 'dateDue', label: 'Vencimiento (timestamp ms)', type: 'number' },
  { key: 'codePaymentType', label: 'Tipo pago' },
  { key: 'base', label: 'Base (EUR)', type: 'number' },
  { key: 'taxes', label: 'IVA (EUR)', type: 'number' },
  { key: 'total', label: 'Total (EUR)', type: 'number' },
  { key: 'paid', label: 'Pagada (1=si)', type: 'number' },
  { key: 'validated', label: 'Validada (1=si)', type: 'number' },
  { key: 'comment', label: 'Comentario' },
]

function fmt(v: number | null) {
  if (v == null) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}

function fmtDate(ts: number | null) {
  if (!ts) return '-'
  return new Date(ts).toLocaleDateString('es-ES')
}

const columns: ColDef[] = [
  { label: 'Nº Factura', render: r => r.invoiceNum || '-', className: 'col-mono' },
  { label: 'Nº Doc', render: r => r.documentNum || '-', className: 'col-mono' },
  { label: 'Proveedor', render: r => r.vendor || '-', className: 'col-main' },
  { label: 'NIF', render: r => r.nif || '-', className: 'col-mono' },
  { label: 'Fecha', render: r => fmtDate(r.date) },
  { label: 'Vencimiento', render: r => fmtDate(r.dateDue) },
  { label: 'Base', render: r => fmt(r.base) },
  { label: 'IVA', render: r => fmt(r.taxes) },
  { label: 'Total', render: r => fmt(r.total), className: 'col-amount' },
  { label: 'Pagada', render: r => r.paid ? <span className="badge badge-green">Si</span> : <span className="badge badge-red">No</span> },
  { label: 'Validada', render: r => r.validated ? <span className="badge badge-green">Si</span> : <span className="badge badge-gray">No</span> },
]

export default function FacturasCompraPage() {
  return <CRUDPage title="Facturas de Compra" entity="facturas-compra" fields={fields} columns={columns} />
}
