'use client'
import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'delivery_num', label: 'Nº Albaran' },
  { key: 'vendor', label: 'Proveedor' },
  { key: 'code_vendor', label: 'Cod. Proveedor' },
  { key: 'nif', label: 'NIF' },
  { key: 'delivery_for', label: 'Entregado para' },
  { key: 'date_delivery', label: 'Fecha Entrega' },
  { key: 'date_sent', label: 'Fecha Envio' },
  { key: 'sent_by', label: 'Enviado por' },
  { key: 'received_by', label: 'Recibido por' },
  { key: 'base', label: 'Base (EUR)', type: 'number' },
  { key: 'taxes', label: 'IVA (EUR)', type: 'number' },
  { key: 'total', label: 'Total (EUR)', type: 'number' },
  { key: 'cost_type', label: 'Tipo coste' },
  { key: 'vendor_type', label: 'Tipo proveedor' },
]

function fmt(v: number | null) {
  if (v == null) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}

const columns: ColDef[] = [
  { label: 'Nº Albaran', render: r => r.delivery_num || '-', className: 'col-mono' },
  { label: 'Proveedor', render: r => r.vendor || '-', className: 'col-main' },
  { label: 'NIF', render: r => r.nif || '-', className: 'col-mono' },
  { label: 'Para', render: r => r.delivery_for || '-' },
  { label: 'Fecha Entrega', render: r => r.date_delivery || '-' },
  { label: 'Enviado por', render: r => r.sent_by || '-' },
  { label: 'Recibido por', render: r => r.received_by || '-' },
  { label: 'Base', render: r => fmt(r.base) },
  { label: 'IVA', render: r => fmt(r.taxes) },
  { label: 'Total', render: r => fmt(r.total), className: 'col-amount' },
  { label: 'Tipo coste', render: r => r.cost_type || '-' },
]

export default function AlbaranesCompraPage() {
  return <CRUDPage title="Albaranes de Compra" entity="albaranes-compra" fields={fields} columns={columns} />
}
