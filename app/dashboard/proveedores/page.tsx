'use client'
import CRUDPage, { FieldDef, ColDef } from '@/components/CRUDPage'

// Formulario lean (feedback): solo lo esencial. Campos técnicos (defecte,
// has_other, email CC, contacto/teléfono/email aux) ocultos del MVP.
const fields: FieldDef[] = [
  { key: 'descr', label: 'Nombre' },
  { key: 'nif', label: 'NIF / CIF' },
  { key: 'descr_type', label: 'Tipo / categoría' },
  { key: 'contact', label: 'Contacto principal' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'mail', label: 'Email' },
  // Opcionales
  { key: 'address', label: 'Dirección (opcional)' },
  { key: 'city', label: 'Ciudad (opcional)' },
  { key: 'cp', label: 'CP (opcional)' },
  { key: 'web', label: 'Web (opcional)' },
  { key: 'comment', label: 'Notas (opcional)' },
]

const columns: ColDef[] = [
  { label: 'Nombre', render: r => r.descr || '-', className: 'col-main' },
  { label: 'Tipo', render: r => r.descr_type || '-' },
  { label: 'NIF', render: r => r.nif || '-', className: 'col-mono' },
  { label: 'Ciudad', render: r => [r.city, r.cp].filter(Boolean).join(' ') || '-' },
  { label: 'Contacto', render: r => r.contact || '-' },
  { label: 'Teléfono', render: r => r.phone || '-' },
  { label: 'Email', render: r => r.mail || '-' },
]

export default function ProveedoresPage() {
  return <CRUDPage title="Proveedores" entity="proveedores" fields={fields} columns={columns} />
}
