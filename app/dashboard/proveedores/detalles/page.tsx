export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { requireServerUser } from '@/lib/auth'
import db from '@/lib/db'

type Prov = {
  id: number; descr: string | null; descr_type: string | null; nif: string | null
  contact: string | null; phone: string | null; mail: string | null; city: string | null
}

export default async function ProveedoresDirectorioPage() {
  const user = await requireServerUser()
  const rows = db.prepare(`
    SELECT id, descr, descr_type, nif, contact, phone, mail, city
    FROM proveedores WHERE user_id = ? ORDER BY descr
  `).all(user.id) as Prov[]

  // Nº de ingredientes por proveedor para enriquecer la tarjeta
  const counts = db.prepare(`
    SELECT proveedor_id, COUNT(*) as c FROM ingredientes WHERE user_id=? AND proveedor_id IS NOT NULL GROUP BY proveedor_id
  `).all(user.id) as { proveedor_id: number; c: number }[]
  const countMap: Record<number, number> = {}
  for (const c of counts) countMap[c.proveedor_id] = c.c

  return (
    <div style={{ padding: '32px 36px 60px' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.2em', color: '#0fa651', textTransform: 'uppercase', margin: '0 0 8px' }}>
          FOOD COST · FICHAS DE PROVEEDOR
        </p>
        <h1 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em', margin: '0 0 6px', color: '#3d3834' }}>
          Directorio de proveedores
        </h1>
        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: '#6c635a', margin: 0 }}>
          Abre la ficha de un proveedor para ver sus ingredientes, pedidos, albaranes, facturas y cambios de precio.
        </p>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#9a8f82', border: '1.5px solid #c4b8a8' }}>
          Sin proveedores. Créalos en la pestaña Lista.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {rows.map(p => (
            <Link key={p.id} href={`/dashboard/proveedores/${p.id}`} style={{
              display: 'block', textDecoration: 'none', background: '#faf6ec', border: '1.5px solid #3d3834', padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 14.5, color: '#3d3834', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descr || '—'}</p>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9a8f82', margin: 0 }}>{p.descr_type || 'Sin tipo'}{p.nif ? ` · ${p.nif}` : ''}</p>
                </div>
                {countMap[p.id] ? (
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9.5, color: '#0fa651', background: '#d6f9e0', border: '1px solid #0fa651', padding: '2px 7px', whiteSpace: 'nowrap' }}>{countMap[p.id]} ingr.</span>
                ) : null}
              </div>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10.5, color: '#6c635a', margin: '10px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[p.contact, p.phone, p.mail].filter(Boolean).join(' · ') || 'Sin contacto'}
              </p>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 600, color: '#0fa651', margin: '8px 0 0', letterSpacing: '0.06em' }}>VER FICHA →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
