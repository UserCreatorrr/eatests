'use client'

import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const MONTH_NAMES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
}

const fields: FieldDef[] = [
  { key: 'descr', label: 'Nombre' },
  { key: 'data', label: 'Dato' },
  { key: 'year', label: 'Ano', type: 'number' },
  { key: 'month', label: 'Mes (1-12)', type: 'number' },
  { key: 'pendingSend', label: 'Pendiente Envio', type: 'number' },
  { key: 'pendingReceive', label: 'Pendiente Recepcion', type: 'number' },
]

const columns: ColDef[] = [
  { label: 'Nombre', render: r => r.descr || '-', className: 'col-main' },
  { label: 'Dato', render: r => r.data || '-' },
  { label: 'Ano', render: r => r.year ?? '-' },
  { label: 'Mes', render: r => r.month ? (MONTH_NAMES[r.month] ?? r.month) : '-' },
  { label: 'Pend. Envio', render: r => r.pendingSend != null ? <span className={`badge ${r.pendingSend > 0 ? 'badge-red' : 'badge-green'}`}>{r.pendingSend}</span> : '-' },
  { label: 'Pend. Recepcion', render: r => r.pendingReceive != null ? <span className={`badge ${r.pendingReceive > 0 ? 'badge-red' : 'badge-green'}`}>{r.pendingReceive}</span> : '-' },
]

export default function ListaPedidosPage() {
  return <CRUDPage title="Lista de Pedidos" entity="lista-pedidos" fields={fields} columns={columns} />
}
