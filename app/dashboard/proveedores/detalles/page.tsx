'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { Empty, Loading, Page } from '@/components/ui'

export default function ProveedoresDirectorioPage() {
  const [rows, setRows] = useState<any[] | null>(null)
  const [counts, setCounts] = useState<Record<number, number>>({})
  useEffect(() => {
    Promise.all([api.get('/api/suppliers'), api.get('/api/ingredients')]).then(([s, i]) => {
      const c: Record<number, number> = {}
      for (const ing of i.data) if (ing.supplier_id) c[ing.supplier_id] = (c[ing.supplier_id] ?? 0) + 1
      setCounts(c); setRows(s.data)
    }).catch(() => setRows([]))
  }, [])

  return (
    <Page eyebrow="Food cost · Fichas de proveedor" title="Directorio de proveedores" subtitle="Abre la ficha de un proveedor para ver sus ingredientes, pedidos, albaranes, facturas y cambios de precio.">
      {!rows ? <Loading /> : rows.length === 0 ? <Empty>Sin proveedores. Créalos en la lista.</Empty> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {rows.map(p => (
            <Link key={p.id} href={`/dashboard/proveedores/${p.id}`} style={{ display: 'block', textDecoration: 'none', background: tk.paper, border: `1.5px solid ${tk.iron}`, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 14.5, color: tk.iron, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                  <p style={{ fontFamily: ff.mono, fontSize: 10, color: tk.iron40, margin: 0 }}>{p.tax_id || 'Sin NIF'}{p.preferred_channel ? ` · ${p.preferred_channel}` : ''}</p>
                </div>
                {counts[p.id] ? <span style={{ fontFamily: ff.mono, fontSize: 9.5, color: tk.appleDeep, background: tk.appleSoft, border: `1px solid ${tk.appleDeep}`, padding: '2px 7px', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>{counts[p.id]} ingr.</span> : null}
              </div>
              <p style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.iron60, margin: '10px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[p.contact_name, p.phone, p.email].filter(Boolean).join(' · ') || 'Sin contacto'}</p>
              <p style={{ fontFamily: ff.mono, fontSize: 10, fontWeight: 600, color: tk.appleDeep, margin: '8px 0 0', letterSpacing: '0.06em' }}>VER FICHA →</p>
            </Link>
          ))}
        </div>
      )}
    </Page>
  )
}
