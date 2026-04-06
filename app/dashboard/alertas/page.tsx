'use client'

import { useState, useEffect } from 'react'

type Urgencia = 'alta' | 'media' | 'baja'
type TipoAlerta = 'stock_bajo' | 'merma' | 'factura_vence' | 'pedido_pendiente'

type Alerta = {
  tipo: TipoAlerta
  titulo: string
  descripcion: string
  urgencia: Urgencia
}

const colorMap: Record<Urgencia, string> = { alta: '#dc2626', media: '#d97706', baja: '#16a34a' }
const bgMap: Record<Urgencia, string> = { alta: '#fef2f2', media: '#fffbeb', baja: '#f0fdf4' }
const iconMap: Record<TipoAlerta, string> = {
  stock_bajo: 'Ingredientes',
  merma: 'Merma',
  factura_vence: 'Factura',
  pedido_pendiente: 'Pedido',
}

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)

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
          titulo: `${sinCoste.length} ingredientes sin coste registrado`,
          descripcion: sinCoste.slice(0, 5).map((i: any) => i.descr).join(', ') + (sinCoste.length > 5 ? '...' : ''),
          urgencia: 'media',
        })
      }

      const pendEnvio = (pedRes.data || []).filter((p: any) => p.pending_send > 0)
      if (pendEnvio.length > 0) {
        alerts.push({
          tipo: 'pedido_pendiente',
          titulo: `${pendEnvio.length} listas de pedidos pendientes de envio`,
          descripcion: pendEnvio.slice(0, 3).map((p: any) => p.descr || 'Sin nombre').join(', '),
          urgencia: 'alta',
        })
      }

      const hoy = new Date()
      const en7dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000)
      const vencenProx = (facRes.data || []).filter((f: any) => {
        if (f.paid) return false
        if (!f.date_due) return false
        return new Date(f.date_due) <= en7dias
      })
      if (vencenProx.length > 0) {
        alerts.push({
          tipo: 'factura_vence',
          titulo: `${vencenProx.length} facturas vencen en los proximos 7 dias`,
          descripcion: vencenProx.slice(0, 3).map((f: any) => `${f.vendor || '-'} (${f.total ? f.total + 'EUR' : '-'})`).join(', '),
          urgencia: 'alta',
        })
      }

      const pendRec = (pedRes.data || []).filter((p: any) => p.pending_receive > 0)
      if (pendRec.length > 0) {
        alerts.push({
          tipo: 'pedido_pendiente',
          titulo: `${pendRec.length} listas pendientes de recepcion`,
          descripcion: pendRec.slice(0, 3).map((p: any) => p.descr || 'Sin nombre').join(', '),
          urgencia: 'media',
        })
      }

      if (alerts.length === 0) {
        alerts.push({ tipo: 'stock_bajo', titulo: 'Todo en orden', descripcion: 'No hay alertas activas.', urgencia: 'baja' })
      }

      setAlertas(alerts)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="p-8">
      <div className="page-header">
        <h1 className="page-title">Alertas y Avisos</h1>
        <p className="page-subtitle">{alertas.length} alerta{alertas.length !== 1 ? 's' : ''} activa{alertas.length !== 1 ? 's' : ''}</p>
      </div>

      {loading ? (
        <div className="empty-state"><p className="page-subtitle">Analizando datos...</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
          {alertas.map((a, i) => (
            <div key={i} style={{
              backgroundColor: bgMap[a.urgencia],
              border: `1.5px solid ${colorMap[a.urgencia]}30`,
              borderRadius: 14, padding: '16px 20px',
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colorMap[a.urgencia], flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 14, color: colorMap[a.urgencia], margin: '0 0 4px' }}>
                  {a.titulo}
                </p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.7, margin: 0 }}>
                  {a.descripcion}
                </p>
              </div>
              <span style={{
                fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 600,
                color: colorMap[a.urgencia], backgroundColor: colorMap[a.urgencia] + '15',
                padding: '3px 8px', borderRadius: 6, flexShrink: 0, textTransform: 'uppercase' as const,
              }}>
                {iconMap[a.tipo]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
