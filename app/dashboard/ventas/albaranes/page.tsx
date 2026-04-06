'use client'

import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'invoiceNum', label: 'Nº Albaran' },
  { key: 'customer', label: 'Cliente' },
  { key: 'customerCode', label: 'Cod. Cliente' },
  { key: 'customerType', label: 'Tipo cliente' },
  { key: 'nif', label: 'NIF' },
  { key: 'contact', label: 'Contacto' },
  { key: 'phone', label: 'Telefono' },
  { key: 'mail', label: 'Email' },
  { key: 'address', label: 'Direccion' },
  { key: 'cp', label: 'CP' },
  { key: 'city', label: 'Ciudad' },
  { key: 'date', label: 'Fecha (timestamp ms)', type: 'number' },
  { key: 'base', label: 'Base (EUR)', type: 'number' },
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
  { label: 'Nº Albaran', render: r => r.invoiceNum || '-', className: 'col-mono' },
  { label: 'Cliente', render: r => r.customer || '-', className: 'col-main' },
  { label: 'Tipo', render: r => r.customerType || '-' },
  { label: 'NIF', render: r => r.nif || '-', className: 'col-mono' },
  { label: 'Contacto', render: r => r.contact || '-' },
  { label: 'Ciudad', render: r => [r.city, r.cp].filter(Boolean).join(' ') || '-' },
  { label: 'Fecha', render: r => fmtDate(r.date) },
  { label: 'Base', render: r => fmt(r.base), className: 'col-amount' },
]

export default function AlbaranesVentaPage() {
  return <CRUDPage title="Albaranes de Venta" entity="albaranes-venta" fields={fields} columns={columns} />
}
