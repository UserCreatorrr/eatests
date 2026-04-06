'use client'

import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'num_order', label: 'Nº Pedido' },
  { key: 'vendor', label: 'Proveedor' },
  { key: 'code_vendor', label: 'Codigo Proveedor' },
  { key: 'nif', label: 'NIF' },
  { key: 'date_order', label: 'Fecha Pedido', type: 'date' },
  { key: 'date_reception', label: 'Fecha Recepcion', type: 'date' },
  { key: 'sent_by', label: 'Enviado por' },
  { key: 'total', label: 'Total (EUR)', type: 'number' },
]

function fmt(v: number | null) {
  if (v == null) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}

const columns: ColDef[] = [
  { label: 'Nº Pedido', render: r => r.num_order || '-', className: 'col-mono' },
  { label: 'Proveedor', render: r => r.vendor || '-', className: 'col-main' },
  { label: 'NIF', render: r => r.nif || '-', className: 'col-mono' },
  { label: 'Fecha Pedido', render: r => r.date_order || '-' },
  { label: 'Fecha Recepcion', render: r => r.date_reception || '-' },
  { label: 'Enviado por', render: r => r.sent_by || '-' },
  { label: 'Total', render: r => fmt(r.total), className: 'col-amount' },
]

export default function PedidosCompraPage() {
  return <CRUDPage title="Pedidos de Compra" entity="pedidos-compra" fields={fields} columns={columns} />
}
