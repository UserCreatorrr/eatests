'use client'
import CRUDPage, { F, type ColDef, type FieldDef } from '@/components/CRUDPage'

const fields: FieldDef[] = [
  { key: 'name', label: 'Nombre', required: true },
  { key: 'taxId', label: 'NIF / CIF' },
  { key: 'contactName', label: 'Contacto principal' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'email', label: 'Email' },
  { key: 'preferredChannel', label: 'Canal preferido', type: 'select', options: [{ value: 'email', label: 'Email' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'phone', label: 'Teléfono' }] },
  { key: 'address', label: 'Dirección' },
  { key: 'city', label: 'Ciudad' },
  { key: 'postalCode', label: 'Código postal' },
  { key: 'website', label: 'Web' },
  { key: 'notes', label: 'Notas' },
]

const columns: ColDef[] = [
  { label: 'Nombre', render: r => <span style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 13 }}>{r.name}</span> },
  { label: 'NIF', render: r => r.tax_id || '—' },
  { label: 'Contacto', render: r => r.contact_name || '—' },
  { label: 'Teléfono', render: r => r.phone || '—' },
  { label: 'Email', render: r => r.email || '—' },
  { label: 'Canal', render: r => r.preferred_channel || '—' },
  { label: 'Ciudad', render: r => [r.city, r.postal_code].filter(Boolean).join(' ') || '—' },
]

export default function ProveedoresPage() {
  return (
    <CRUDPage
      title="Proveedores" eyebrow="Food cost · Catálogo" endpoint="/api/suppliers" fields={fields} columns={columns} singular="proveedor"
      rowHref={r => `/dashboard/proveedores/${r.id}`}
      fromRow={r => ({ name: r.name ?? '', taxId: r.tax_id ?? '', contactName: r.contact_name ?? '', phone: r.phone ?? '', email: r.email ?? '', preferredChannel: r.preferred_channel ?? '', address: r.address ?? '', city: r.city ?? '', postalCode: r.postal_code ?? '', website: r.website ?? '', notes: r.notes ?? '' })}
      toBody={f => ({ name: f.name, taxId: F.str(f.taxId), contactName: F.str(f.contactName), phone: F.str(f.phone), email: F.str(f.email), preferredChannel: F.str(f.preferredChannel), address: F.str(f.address), city: F.str(f.city), postalCode: F.str(f.postalCode), website: F.str(f.website), notes: F.str(f.notes) })}
    />
  )
}
