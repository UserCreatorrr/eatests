'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { Page } from '@/components/ui'

type Alert = { id: string; tipo: 'danger' | 'warning' | 'info'; titulo: string; detalle: string; href?: string; chat?: string; count?: number }
const COLOR: Record<string, string> = { danger: tk.terra, warning: tk.clay, info: tk.appleDeep }
const BG: Record<string, string> = { danger: tk.terraSoft, warning: tk.claySoft, info: tk.appleSoft }
const LABEL: Record<string, string> = { danger: 'Urgente', warning: 'Aviso', info: 'Info' }
const cta = (href?: string) => !href ? 'Ver detalle' : href.includes('facturas') ? 'Ver facturas' : href.includes('pedidos') ? 'Ver pedidos' : href.includes('albaranes') ? 'Ver albaranes' : href.includes('ingredientes') ? 'Completar ingredientes' : href.includes('sangrado') ? 'Ver escandallos' : href.includes('merma') ? 'Ver merma' : href.includes('analytics') ? 'Ver desviaciones' : 'Ver detalle'

export default function AlertasPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[] | null>(null)
  useEffect(() => { api.get('/api/alerts').then(r => setAlerts(r.alerts)).catch(() => setAlerts([])) }, [])
  const urgent = alerts?.filter(a => a.tipo === 'danger').length ?? 0
  const now = new Date().toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <Page eyebrow="Analytics" title="Alertas y avisos" subtitle={!alerts ? 'Analizando datos…' : alerts.length === 0 ? 'Todo en orden: no hay alertas activas' : <>{alerts.length} alerta{alerts.length !== 1 ? 's' : ''} activa{alerts.length !== 1 ? 's' : ''}{urgent > 0 && <> · <span style={{ color: tk.terra }}>{urgent} urgente{urgent !== 1 ? 's' : ''}</span></>}<span style={{ opacity: 0.4 }}> · actualizado {now}</span></>}>
      {!alerts ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1, 2, 3].map(i => <div key={i} style={{ height: 80, background: tk.creamSoft, opacity: 0.5 }} />)}</div>
        : alerts.length === 0 ? (
          <div style={{ background: tk.appleSoft, border: `1.5px solid ${tk.appleDeep}`, padding: '24px 28px', display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: tk.appleDeep }} />
            <div><p style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 15, color: tk.appleDeep, margin: '0 0 2px' }}>Todo en orden</p><p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.appleDeep, opacity: 0.7, margin: 0 }}>Cada aviso sale de un dato real: facturas, pedidos, precios, escandallos y merma.</p></div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {alerts.map(a => (
              <div key={a.id} onClick={() => router.push(a.href || '/dashboard')} style={{ background: BG[a.tipo], border: `1.5px solid ${COLOR[a.tipo]}55`, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'pointer' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR[a.tipo], flexShrink: 0, marginTop: 6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 14, color: COLOR[a.tipo], margin: '0 0 4px' }}>{a.titulo}</p>
                  <p style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron, opacity: 0.75, margin: 0 }}>{a.detalle}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontFamily: ff.mono, fontSize: 10, fontWeight: 600, color: COLOR[a.tipo], background: COLOR[a.tipo] + '18', padding: '3px 8px', textTransform: 'uppercase' }}>{LABEL[a.tipo]}</span>
                  <button onClick={e => { e.stopPropagation(); router.push(a.href || '/dashboard') }} style={{ fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: COLOR[a.tipo], background: COLOR[a.tipo] + '12', border: `1px solid ${COLOR[a.tipo]}55`, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{cta(a.href)} →</button>
                </div>
              </div>
            ))}
          </div>
        )}
    </Page>
  )
}
