'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Urgencia = 'alta' | 'media' | 'baja'
type TipoAlerta = 'stock_bajo' | 'merma' | 'factura_vence' | 'pedido_pendiente' | 'recepcion_pendiente'

type Alerta = {
  tipo: TipoAlerta
  titulo: string
  descripcion: string
  urgencia: Urgencia
  link: string
  cta: string
  count: number
}

const colorMap: Record<Urgencia, string> = { alta: '#a83e1e', media: '#c97b3d', baja: '#0fa651' }
const bgMap: Record<Urgencia, string> = { alta: '#fbeae2', media: '#fcf2e8', baja: '#d6f9e0' }
const labelMap: Record<Urgencia, string> = { alta: 'Urgente', media: 'Aviso', baja: 'Info' }

const tipoLabel: Record<TipoAlerta, string> = {
  stock_bajo: 'Ingredientes',
  merma: 'Merma',
  factura_vence: 'Facturas',
  pedido_pendiente: 'Pedidos',
  recepcion_pendiente: 'Recepción',
}

function fmt(v: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const [ingRes, pedRes, facRes] = await Promise.all([
        fetch('/api/data/ingredientes?limit=1000').then(r => r.json()),
        fetch('/api/data/lista-pedidos?limit=500').then(r => r.json()),
        fetch('/api/data/facturas-compra?limit=500').then(r => r.json()),
      ])

      const alerts: Alerta[] = []

      const sinCoste = (ingRes.data || []).filter((i: any) => !i.cost)
      if (sinCoste.length > 0) {
        alerts.push({
          tipo: 'stock_bajo',
          titulo: `${sinCoste.length} ingrediente${sinCoste.length !== 1 ? 's' : ''} sin coste registrado`,
          descripcion: sinCoste.slice(0, 5).map((i: any) => i.descr).join(', ') + (sinCoste.length > 5 ? `… y ${sinCoste.length - 5} más` : ''),
          urgencia: 'media',
          link: '/dashboard/ingredientes',
          cta: 'Ir a Ingredientes',
          count: sinCoste.length,
        })
      }

      const pendEnvio = (pedRes.data || []).filter((p: any) => p.pending_send > 0)
      if (pendEnvio.length > 0) {
        alerts.push({
          tipo: 'pedido_pendiente',
          titulo: `${pendEnvio.length} lista${pendEnvio.length !== 1 ? 's' : ''} de pedidos pendiente${pendEnvio.length !== 1 ? 's' : ''} de envío`,
          descripcion: pendEnvio.slice(0, 3).map((p: any) => p.descr || 'Sin nombre').join(', ') + (pendEnvio.length > 3 ? ` y ${pendEnvio.length - 3} más` : ''),
          urgencia: 'alta',
          link: '/dashboard/compras/pedidos',
          cta: 'Ver pedidos',
          count: pendEnvio.length,
        })
      }

      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const en7dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000)

      const vencidas = (facRes.data || []).filter((f: any) => {
        if (f.paid) return false
        if (!f.date_due) return false
        return new Date(f.date_due) < hoy
      })
      if (vencidas.length > 0) {
        const total = vencidas.reduce((s: number, f: any) => s + (f.total || 0), 0)
        alerts.push({
          tipo: 'factura_vence',
          titulo: `${vencidas.length} factura${vencidas.length !== 1 ? 's' : ''} vencida${vencidas.length !== 1 ? 's' : ''} sin pagar`,
          descripcion: `Total pendiente: ${fmt(total)} · ${vencidas.slice(0, 2).map((f: any) => f.vendor || '-').join(', ')}${vencidas.length > 2 ? ` y ${vencidas.length - 2} más` : ''}`,
          urgencia: 'alta',
          link: '/dashboard/compras/facturas',
          cta: 'Ver facturas',
          count: vencidas.length,
        })
      }

      const vencenProx = (facRes.data || []).filter((f: any) => {
        if (f.paid) return false
        if (!f.date_due) return false
        const d = new Date(f.date_due)
        return d >= hoy && d <= en7dias
      })
      if (vencenProx.length > 0) {
        const total = vencenProx.reduce((s: number, f: any) => s + (f.total || 0), 0)
        alerts.push({
          tipo: 'factura_vence',
          titulo: `${vencenProx.length} factura${vencenProx.length !== 1 ? 's' : ''} vence${vencenProx.length === 1 ? '' : 'n'} en los próximos 7 días`,
          descripcion: `Total: ${fmt(total)} · ${vencenProx.slice(0, 2).map((f: any) => f.vendor || '-').join(', ')}${vencenProx.length > 2 ? ` y ${vencenProx.length - 2} más` : ''}`,
          urgencia: 'media',
          link: '/dashboard/compras/facturas',
          cta: 'Ver facturas',
          count: vencenProx.length,
        })
      }

      const pendRec = (pedRes.data || []).filter((p: any) => p.pending_receive > 0)
      if (pendRec.length > 0) {
        alerts.push({
          tipo: 'recepcion_pendiente',
          titulo: `${pendRec.length} lista${pendRec.length !== 1 ? 's' : ''} pendiente${pendRec.length !== 1 ? 's' : ''} de recepción`,
          descripcion: pendRec.slice(0, 3).map((p: any) => p.descr || 'Sin nombre').join(', ') + (pendRec.length > 3 ? ` y ${pendRec.length - 3} más` : ''),
          urgencia: 'media',
          link: '/dashboard/compras/pedidos',
          cta: 'Ver pedidos',
          count: pendRec.length,
        })
      }

      setAlertas(alerts)
      setLoading(false)
    }
    load()
  }, [])

  const ahora = new Date().toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const urgentes = alertas.filter(a => a.urgencia === 'alta').length

  return (
    <div className="p-8">
      <div className="page-header">
        <div>
          <h1 className="page-title">Alertas y Avisos</h1>
          <p className="page-subtitle">
            {loading ? 'Analizando datos...' : (
              alertas.length === 0
                ? 'Todo en orden — no hay alertas activas'
                : <>
                    {alertas.length} alerta{alertas.length !== 1 ? 's' : ''} activa{alertas.length !== 1 ? 's' : ''}
                    {urgentes > 0 && <> · <span style={{ color: '#a83e1e' }}>{urgentes} urgente{urgentes !== 1 ? 's' : ''}</span></>}
                    <span style={{ opacity: 0.4 }}> · actualizado {ahora}</span>
                  </>
            )}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 80, backgroundColor: '#f5f2ee', borderRadius: 14, opacity: 0.5 }} />
          ))}
        </div>
      ) : alertas.length === 0 ? (
        <div style={{
          backgroundColor: '#d6f9e0', border: '1.5px solid #0fa651', borderRadius: 14,
          padding: '24px 28px', maxWidth: 720, display: 'flex', gap: 14, alignItems: 'center',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#0fa651', flexShrink: 0 }} />
          <div>
            <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 15, color: '#0fa651', margin: '0 0 2px' }}>
              Todo en orden
            </p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#0fa651', opacity: 0.7, margin: 0 }}>
              No hay alertas activas en este momento.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
          {alertas.map((a, i) => (
            <div
              key={i}
              style={{
                backgroundColor: bgMap[a.urgencia],
                border: `1.5px solid ${colorMap[a.urgencia]}30`,
                borderRadius: 14, padding: '16px 20px',
                display: 'flex', gap: 14, alignItems: 'flex-start',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
              onClick={() => router.push(a.link)}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px ${colorMap[a.urgencia]}20`
                ;(e.currentTarget as HTMLDivElement).style.borderColor = `${colorMap[a.urgencia]}60`
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                ;(e.currentTarget as HTMLDivElement).style.borderColor = `${colorMap[a.urgencia]}30`
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colorMap[a.urgencia], flexShrink: 0, marginTop: 6 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 14, color: colorMap[a.urgencia], margin: '0 0 4px' }}>
                  {a.titulo}
                </p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.7, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.descripcion}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <span style={{
                  fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 600,
                  color: colorMap[a.urgencia], backgroundColor: colorMap[a.urgencia] + '18',
                  padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' as const,
                }}>
                  {labelMap[a.urgencia]}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); router.push(a.link) }}
                  style={{
                    fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 600,
                    color: colorMap[a.urgencia], backgroundColor: colorMap[a.urgencia] + '12',
                    border: `1px solid ${colorMap[a.urgencia]}30`,
                    padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
                    whiteSpace: 'nowrap' as const,
                  }}
                >
                  {a.cta} →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
