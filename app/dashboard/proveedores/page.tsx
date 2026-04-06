'use client'
import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'codi', label: 'Codigo' },
  { key: 'descr', label: 'Nombre' },
  { key: 'descr_type', label: 'Tipo' },
  { key: 'nif', label: 'NIF' },
  { key: 'alt_descr', label: 'Nombre alternativo' },
  { key: 'comment', label: 'Comentario' },
  { key: 'address', label: 'Direccion' },
  { key: 'city', label: 'Ciudad' },
  { key: 'cp', label: 'CP' },
  { key: 'contact', label: 'Contacto' },
  { key: 'phone', label: 'Telefono' },
  { key: 'mail', label: 'Email' },
  { key: 'contact_aux', label: 'Contacto aux.' },
  { key: 'phone_aux', label: 'Telefono aux.' },
  { key: 'mail_aux', label: 'Email aux.' },
  { key: 'mailcc', label: 'Email CC' },
  { key: 'web', label: 'Web' },
  { key: 'defecte', label: 'Por defecto (1=si)', type: 'number' },
  { key: 'has_other', label: 'Tiene otros (1=si)', type: 'number' },
]

const columns: ColDef[] = [
  { label: 'Codigo', render: r => r.codi || '-', className: 'col-mono' },
  { label: 'Nombre', render: r => r.descr || '-', className: 'col-main' },
  { label: 'Tipo', render: r => r.descr_type || '-' },
  { label: 'NIF', render: r => r.nif || '-', className: 'col-mono' },
  { label: 'Ciudad', render: r => [r.city, r.cp].filter(Boolean).join(' ') || '-' },
  { label: 'Contacto', render: r => r.contact || '-' },
  { label: 'Telefono', render: r => r.phone || '-' },
  { label: 'Email', render: r => r.mail || '-' },
  { label: 'Por defecto', render: r => r.defecte ? <span className="badge badge-green">Si</span> : <span className="badge badge-gray">No</span> },
]

export default function ProveedoresPage() {
  return <CRUDPage title="Proveedores" entity="proveedores" fields={fields} columns={columns} />
}
