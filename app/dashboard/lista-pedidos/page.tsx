'use client'
import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const MONTHS: Record<number, string> = {
  1:'Enero',2:'Febrero',3:'Marzo',4:'Abril',5:'Mayo',6:'Junio',
  7:'Julio',8:'Agosto',9:'Septiembre',10:'Octubre',11:'Noviembre',12:'Diciembre',
}

const fields: FieldDef[] = [
  { key: 'descr', label: 'Nombre' },
  { key: 'data', label: 'Dato (data)' },
  { key: 'year', label: 'Ano', type: 'number' },
  { key: 'month', label: 'Mes (1-12)', type: 'number' },
  { key: 'pending_send', label: 'Pendiente envio', type: 'number' },
  { key: 'pending_receive', label: 'Pendiente recepcion', type: 'number' },
  { key: 'defecte', label: 'Por defecto (1=si)', type: 'number' },
  { key: 'locked', label: 'Bloqueado (1=si)', type: 'number' },
]

const columns: ColDef[] = [
  { label: 'Nombre', render: r => r.descr || '-', className: 'col-main' },
  { label: 'Dato', render: r => r.data || '-' },
  { label: 'Ano', render: r => r.year ?? '-' },
  { label: 'Mes', render: r => r.month ? (MONTHS[r.month] ?? r.month) : '-' },
  { label: 'Pend. Envio', render: r => r.pending_send != null ? <span className={`badge ${r.pending_send > 0 ? 'badge-red' : 'badge-green'}`}>{r.pending_send}</span> : '-' },
  { label: 'Pend. Recepcion', render: r => r.pending_receive != null ? <span className={`badge ${r.pending_receive > 0 ? 'badge-red' : 'badge-green'}`}>{r.pending_receive}</span> : '-' },
  { label: 'Bloqueado', render: r => r.locked ? <span className="badge badge-red">Si</span> : <span className="badge badge-gray">No</span> },
]

export default function ListaPedidosPage() {
  return <CRUDPage title="Lista de Pedidos" entity="lista-pedidos" fields={fields} columns={columns} />
}
