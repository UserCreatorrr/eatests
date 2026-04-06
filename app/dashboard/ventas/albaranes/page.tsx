'use client'

import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'invoice_num', label: 'Nº Albaran' },
  { key: 'customer', label: 'Cliente' },
  { key: 'customer_code', label: 'Cod. Cliente' },
  { key: 'customer_type', label: 'Tipo cliente' },
  { key: 'nif', label: 'NIF' },
  { key: 'contact', label: 'Contacto' },
  { key: 'phone', label: 'Telefono' },
  { key: 'mail', label: 'Email' },
  { key: 'address', label: 'Direccion' },
  { key: 'cp', label: 'CP' },
  { key: 'city', label: 'Ciudad' },
  { key: 'date_delivery', label: 'Fecha Entrega', type: 'date' },
  { key: 'base', label: 'Base (EUR)', type: 'number' },
]

function fmt(v: number | null) {
  if (v == null) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}

const columns: ColDef[] = [
  { label: 'Nº Albaran', render: r => r.invoice_num || '-', className: 'col-mono' },
  { label: 'Cliente', render: r => r.customer || '-', className: 'col-main' },
  { label: 'Tipo', render: r => r.customer_type || '-' },
  { label: 'NIF', render: r => r.nif || '-', className: 'col-mono' },
  { label: 'Contacto', render: r => r.contact || '-' },
  { label: 'Ciudad', render: r => [r.city, r.cp].filter(Boolean).join(' ') || '-' },
  { label: 'Fecha', render: r => r.date_delivery || '-' },
  { label: 'Base', render: r => fmt(r.base), className: 'col-amount' },
]

export default function AlbaranesVentaPage() {
  return <CRUDPage title="Albaranes de Venta" entity="albaranes-venta" fields={fields} columns={columns} />
}
