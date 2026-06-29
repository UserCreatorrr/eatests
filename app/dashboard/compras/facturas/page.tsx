'use client'
import { useMemo } from 'react'
import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'invoice_num', label: 'Nº Factura (vacío = automático)' },
  { key: 'document_num', label: 'Nº Documento' },
  { key: 'vendor', label: 'Proveedor' },
  { key: 'code_vendor', label: 'Cód. Proveedor' },
  { key: 'nif', label: 'NIF' },
  { key: 'account_vendor', label: 'Cuenta proveedor' },
  { key: 'date_invoice', label: 'Fecha Factura' },
  { key: 'date_accounting', label: 'Fecha Contable' },
  { key: 'date_due', label: 'Vencimiento' },
  { key: 'code_payment_type', label: 'Tipo pago' },
  { key: 'base', label: 'Base (EUR)', type: 'number' },
  { key: 'taxes', label: 'IVA (EUR)', type: 'number' },
  { key: 'total', label: 'Total (EUR)', type: 'number' },
  { key: 'paid', label: 'Pagada (1=sí)', type: 'number' },
  { key: 'validated', label: 'Validada (1=sí)', type: 'number' },
  { key: 'comment', label: 'Comentario' },
]

function fmt(v: number | null) {
  if (v == null) return '-'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}

function dueBadge(date_due: string | null, paid: number | null) {
  if (paid) return null
  if (!date_due) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(date_due)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)

  if (diffDays < 0) {
    const dias = Math.abs(diffDays)
    return (
      <span style={{
        fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700,
        backgroundColor: '#fbeae2', color: '#a83e1e',
        padding: '2px 7px', borderRadius: 5, marginLeft: 6, whiteSpace: 'nowrap' as const,
      }}>
        VENCIDA {dias}d
      </span>
    )
  }
  if (diffDays === 0) {
    return (
      <span style={{
        fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700,
        backgroundColor: '#fff7ed', color: '#c97b3d',
        padding: '2px 7px', borderRadius: 5, marginLeft: 6, whiteSpace: 'nowrap' as const,
      }}>
        HOY
      </span>
    )
  }
  if (diffDays <= 7) {
    return (
      <span style={{
        fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700,
        backgroundColor: '#fcf2e8', color: '#c97b3d',
        padding: '2px 7px', borderRadius: 5, marginLeft: 6, whiteSpace: 'nowrap' as const,
      }}>
        {diffDays}d
      </span>
    )
  }
  return null
}

export default function FacturasCompraPage() {
  const asOf = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })

  const columns: ColDef[] = useMemo(() => [
    { label: 'Nº Factura', render: r => r.invoice_num || '-', className: 'col-mono' },
    { label: 'Proveedor', render: r => r.vendor || '-', className: 'col-main' },
    { label: 'NIF', render: r => r.nif || '-', className: 'col-mono' },
    { label: 'Fecha', render: r => r.date_invoice || '-' },
    {
      label: 'Vencimiento',
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
          {r.date_due || '-'}
          {dueBadge(r.date_due, r.paid)}
        </span>
      ),
    },
    { label: 'Base', render: r => fmt(r.base) },
    { label: 'IVA', render: r => fmt(r.taxes) },
    { label: 'Total', render: r => fmt(r.total), className: 'col-amount' },
    {
      label: 'Estado',
      render: r => {
        if (r.paid) return <span className="badge badge-green">Pagada</span>
        if (!r.date_due) return <span className="badge badge-gray">Pendiente</span>
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const due = new Date(r.date_due); due.setHours(0, 0, 0, 0)
        if (due < today) return <span className="badge badge-red">Vencida</span>
        if ((due.getTime() - today.getTime()) / 86400000 <= 7) return <span className="badge badge-yellow">Vence pronto</span>
        return <span className="badge badge-gray">Pendiente</span>
      },
    },
    { label: 'Validada', render: r => r.validated ? <span className="badge badge-green">Sí</span> : <span className="badge badge-gray">No</span> },
  ], [])

  return (
    <CRUDPage
      title={`Facturas de Compra — as of ${asOf}`}
      entity="facturas-compra"
      fields={fields}
      columns={columns}
    />
  )
}
