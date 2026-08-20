'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Urgencia = 'alta' | 'media' | 'baja'

type Alerta = {
  tipo: string
  titulo: string
  descripcion: string
  urgencia: Urgencia
  link: string
  cta: string
}

const colorMap: Record<Urgencia, string> = { alta: '#a83e1e', media: '#c97b3d', baja: '#0fa651' }
const bgMap: Record<Urgencia, string> = { alta: '#fbeae2', media: '#fcf2e8', baja: '#d6f9e0' }
const labelMap: Record<Urgencia, string> = { alta: 'Urgente', media: 'Aviso', baja: 'Info' }

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Fuente ÚNICA de alertas: /api/alerts. Antes esta pantalla se fabricaba sus
    // propias alertas leyendo tablas sueltas, así que ignoraba las de precio,
    // food cost crítico y merma, y aparecía vacía aunque hubiera avisos reales.
    async function load() {
      try {
        const res = await fetch('/api/alerts').then(r => r.json())
        const urgencia = (t: string): Urgencia => t === 'danger' ? 'alta' : t === 'warning' ? 'media' : 'baja'
        const ctaDe = (href?: string) =>
          !href ? 'Ver detalle'
          : href.includes('facturas') ? 'Ver facturas'
          : href.includes('pedidos') ? 'Ver pedidos'
          : href.includes('ingredientes') ? 'Completar ingredientes'
          : href.includes('sangrado') ? 'Ver escandallos'
          : href.includes('merma') ? 'Ver merma'
          : href.includes('analytics') ? 'Ver desviaciones'
          : 'Ver detalle'

        setAlertas((res.alerts || []).map((a: any) => ({
          tipo: a.id,
          titulo: a.titulo,
          descripcion: a.detalle,
          urgencia: urgencia(a.tipo),
          link: a.href || '/dashboard',
          cta: ctaDe(a.href),
        })))
      } catch {
        setAlertas([])
      }
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 80, backgroundColor: '#f5f2ee', borderRadius: 0, opacity: 0.5 }} />
          ))}
        </div>
      ) : alertas.length === 0 ? (
        <div style={{
          backgroundColor: '#d6f9e0', border: '1.5px solid #0fa651', borderRadius: 0,
          padding: '24px 28px', display: 'flex', gap: 14, alignItems: 'center',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alertas.map((a, i) => (
            <div
              key={i}
              style={{
                backgroundColor: bgMap[a.urgencia],
                border: `1.5px solid ${colorMap[a.urgencia]}30`,
                borderRadius: 0, padding: '16px 20px',
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
