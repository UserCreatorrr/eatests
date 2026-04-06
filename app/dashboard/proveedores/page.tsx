'use client'

import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'codi', label: 'Codigo' },
  { key: 'descr', label: 'Nombre' },
  { key: 'descrType', label: 'Tipo' },
  { key: 'nif', label: 'NIF' },
  { key: 'contact', label: 'Contacto' },
  { key: 'phone', label: 'Telefono' },
  { key: 'mail', label: 'Email' },
  { key: 'address', label: 'Direccion' },
  { key: 'city', label: 'Ciudad' },
  { key: 'cp', label: 'CP' },
  { key: 'web', label: 'Web' },
]

const columns: ColDef[] = [
  { label: 'Codigo', render: r => r.codi || '-', className: 'col-mono' },
  { label: 'Nombre', render: r => r.descr || '-', className: 'col-main' },
  { label: 'Tipo', render: r => r.descrType || '-' },
  { label: 'NIF', render: r => r.nif || '-', className: 'col-mono' },
  { label: 'Contacto', render: r => r.contact || '-' },
  { label: 'Telefono', render: r => r.phone || '-' },
  { label: 'Ciudad', render: r => r.city || '-' },
  { label: 'Por defecto', render: r => r.defecte ? <span className="badge badge-green">Si</span> : <span className="badge badge-gray">No</span> },
]

export default function ProveedoresPage() {
  return <CRUDPage title="Proveedores" entity="proveedores" fields={fields} columns={columns} />
}
