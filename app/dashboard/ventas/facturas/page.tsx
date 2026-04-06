'use client'
import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'invoice_num', label: 'Nº Factura' },
  { key: 'document_num', label: 'Nº Documento' },
  { key: 'customer', label: 'Cliente' },
  { key: 'code_customer', label: 'Cod. Cliente' },
  { key: 'nif', label: 'NIF' },
  { key: 'account_customer', label: 'Cuenta cliente' },
  { key: 'date_invoice', label: 'Fecha Factura' },
  { key: 'date_accounting', label: 'Fecha Contable' },
  { key: 'date_due', label: 'Vencimiento' },
  { key: 'code_payment_type', label: 'Tipo pago' },
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

const columns: ColDef[] = [
  { label: 'Nº Factura', render: r => r.invoice_num || '-', className: 'col-mono' },
  { label: 'Nº Doc', render: r => r.document_num || '-', className: 'col-mono' },
  { label: 'Cliente', render: r => r.customer || '-', className: 'col-main' },
  { label: 'NIF', render: r => r.nif || '-', className: 'col-mono' },
  { label: 'Fecha', render: r => r.date_invoice || '-' },
  { label: 'Vencimiento', render: r => r.date_due || '-' },
  { label: 'Base', render: r => fmt(r.base) },
  { label: 'IVA', render: r => fmt(r.taxes) },
  { label: 'Total', render: r => fmt(r.total), className: 'col-amount' },
  { label: 'Pagada', render: r => r.paid ? <span className="badge badge-green">Si</span> : <span className="badge badge-red">No</span> },
]

export default function FacturasVentaPage() {
  return <CRUDPage title="Facturas de Venta" entity="facturas-venta" fields={fields} columns={columns} />
}
