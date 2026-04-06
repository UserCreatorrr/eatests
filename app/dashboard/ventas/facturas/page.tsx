'use client'

import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'invoiceNum', label: 'Nº Factura' },
  { key: 'documentNum', label: 'Nº Documento' },
  { key: 'customer', label: 'Cliente' },
  { key: 'codeCustomer', label: 'Cod. Cliente' },
  { key: 'nif', label: 'NIF' },
  { key: 'accountCustomer', label: 'Cuenta cliente' },
  { key: 'date', label: 'Fecha (timestamp ms)', type: 'number' },
  { key: 'dateAccounting', label: 'Fecha contable (timestamp ms)', type: 'number' },
  { key: 'dateDue', label: 'Vencimiento (timestamp ms)', type: 'number' },
  { key: 'codePaymentType', label: 'Tipo pago' },
  { key: 'base', label: 'Base (EUR)', type: 'number' },
  { key: 'taxes', label: 'IVA (EUR)', type: 'number' },
  { key: 'total', label: 'Total (EUR)', type: 'number' },
  { key: 'paid', label: 'Pagada (1=si)', type: 'number' },
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
  { label: 'Cliente', render: r => r.customer || '-', className: 'col-main' },
  { label: 'NIF', render: r => r.nif || '-', className: 'col-mono' },
  { label: 'Fecha', render: r => fmtDate(r.date) },
  { label: 'Vencimiento', render: r => fmtDate(r.dateDue) },
  { label: 'Base', render: r => fmt(r.base) },
  { label: 'IVA', render: r => fmt(r.taxes) },
  { label: 'Total', render: r => fmt(r.total), className: 'col-amount' },
  { label: 'Pagada', render: r => r.paid ? <span className="badge badge-green">Si</span> : <span className="badge badge-red">No</span> },
]

export default function FacturasVentaPage() {
  return <CRUDPage title="Facturas de Venta" entity="facturas-venta" fields={fields} columns={columns} />
}
