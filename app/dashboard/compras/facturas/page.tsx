'use client'

import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'invoice_num', label: 'Nº Factura' },
  { key: 'document_num', label: 'Nº Documento' },
  { key: 'vendor', label: 'Proveedor' },
  { key: 'code_vendor', label: 'Cod. Proveedor' },
  { key: 'nif', label: 'NIF' },
  { key: 'account_vendor', label: 'Cuenta proveedor' },
  { key: 'date_invoice', label: 'Fecha Factura', type: 'date' },
  { key: 'date_accounting', label: 'Fecha Contable', type: 'date' },
  { key: 'date_due', label: 'Vencimiento', type: 'date' },
  { key: 'code_payment_type', label: 'Tipo pago' },
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

const columns: ColDef[] = [
  { label: 'Nº Factura', render: r => r.invoice_num || '-', className: 'col-mono' },
  { label: 'Nº Doc', render: r => r.document_num || '-', className: 'col-mono' },
  { label: 'Proveedor', render: r => r.vendor || '-', className: 'col-main' },
  { label: 'NIF', render: r => r.nif || '-', className: 'col-mono' },
  { label: 'Fecha', render: r => r.date_invoice || '-' },
  { label: 'Vencimiento', render: r => r.date_due || '-' },
  { label: 'Base', render: r => fmt(r.base) },
  { label: 'IVA', render: r => fmt(r.taxes) },
  { label: 'Total', render: r => fmt(r.total), className: 'col-amount' },
  { label: 'Pagada', render: r => r.paid ? <span className="badge badge-green">Si</span> : <span className="badge badge-red">No</span> },
  { label: 'Validada', render: r => r.validated ? <span className="badge badge-green">Si</span> : <span className="badge badge-gray">No</span> },
]

export default function FacturasCompraPage() {
  return <CRUDPage title="Facturas de Compra" entity="facturas-compra" fields={fields} columns={columns} />
}
