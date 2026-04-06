'use client'

import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'codi', label: 'Codigo' },
  { key: 'descr', label: 'Nombre' },
  { key: 'descr_type', label: 'Tipo' },
  { key: 'defecte', label: 'Por defecto (1=si, 0=no)', type: 'number' },
]

const columns: ColDef[] = [
  { label: 'Codigo', render: r => r.codi || '-', className: 'col-mono' },
  { label: 'Nombre', render: r => r.descr || '-', className: 'col-main' },
  { label: 'Tipo', render: r => r.descr_type || '-' },
  { label: 'Por defecto', render: r => r.defecte ? <span className="badge badge-green">Si</span> : <span className="badge badge-gray">No</span> },
]

export default function ProveedoresPage() {
  return <CRUDPage title="Proveedores" entity="proveedores" fields={fields} columns={columns} />
}
