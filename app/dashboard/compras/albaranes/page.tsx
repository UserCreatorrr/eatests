'use client'

import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'vendor', label: 'Proveedor' },
  { key: 'deliveryNum', label: 'Nº Albaran' },
  { key: 'nif', label: 'NIF' },
  { key: 'date', label: 'Fecha (timestamp ms)', type: 'number' },
  { key: 'sentBy', label: 'Enviado por' },
  { key: 'receivedBy', label: 'Recibido por' },
  { key: 'base', label: 'Base (EUR)', type: 'number' },
  { key: 'taxes', label: 'IVA (EUR)', type: 'number' },
  { key: 'total', label: 'Total (EUR)', type: 'number' },
  { key: 'costType', label: 'Tipo coste' },
  { key: 'codeCostType', label: 'Cod. coste' },
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
  { label: 'Nº Albaran', render: r => r.deliveryNum || '-', className: 'col-mono' },
  { label: 'Proveedor', render: r => r.vendor || '-', className: 'col-main' },
  { label: 'NIF', render: r => r.nif || '-', className: 'col-mono' },
  { label: 'Fecha', render: r => r.dateFormatted || fmtDate(r.date) },
  { label: 'Enviado por', render: r => r.sentBy || '-' },
  { label: 'Recibido por', render: r => r.receivedBy || '-' },
  { label: 'Base', render: r => fmt(r.base) },
  { label: 'IVA', render: r => fmt(r.taxes) },
  { label: 'Total', render: r => fmt(r.total), className: 'col-amount' },
  { label: 'Tipo coste', render: r => r.costType || '-' },
]

export default function AlbaranesCompraPage() {
  return <CRUDPage title="Albaranes de Compra" entity="albaranes-compra" fields={fields} columns={columns} />
}
