'use client'

import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'numOrder', label: 'Nº Pedido' },
  { key: 'vendor', label: 'Proveedor' },
  { key: 'codeVendor', label: 'Cod. Proveedor' },
  { key: 'nif', label: 'NIF' },
  { key: 'dateOrder', label: 'Fecha Pedido (timestamp ms)', type: 'number' },
  { key: 'dateReception', label: 'Fecha Recepcion (timestamp ms)', type: 'number' },
  { key: 'sentBy', label: 'Enviado por' },
  { key: 'total', label: 'Total (EUR)', type: 'number' },
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
  { label: 'Nº Pedido', render: r => r.numOrder || '-', className: 'col-mono' },
  { label: 'Proveedor', render: r => r.vendor || '-', className: 'col-main' },
  { label: 'Cod. Prov.', render: r => r.codeVendor || '-', className: 'col-mono' },
  { label: 'NIF', render: r => r.nif || '-', className: 'col-mono' },
  { label: 'Fecha Pedido', render: r => fmtDate(r.dateOrder) },
  { label: 'Fecha Recepcion', render: r => fmtDate(r.dateReception) },
  { label: 'Enviado por', render: r => r.sentBy || '-' },
  { label: 'Total', render: r => fmt(r.total), className: 'col-amount' },
]

export default function PedidosCompraPage() {
  return <CRUDPage title="Pedidos de Compra" entity="pedidos-compra" fields={fields} columns={columns} />
}
