'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import KitchenChat from '@/components/KitchenChat'

type CardTipo = 'danger' | 'warning' | 'info'

interface DashboardCard {
  id: string
  tipo: CardTipo
  titulo: string
  detalle: string
  items: string[]
  mas: number
  link: string
  cta: string
}

const colorMap: Record<CardTipo, string> = {
  danger: '#dc2626',
  warning: '#d97706',
  info: '#2563eb',
}
const bgMap: Record<CardTipo, string> = {
  danger: '#fef2f2',
  warning: '#fffbeb',
  info: '#eff6ff',
}
const labelMap: Record<CardTipo, string> = {
  danger: 'Urgente',
  warning: 'Aviso',
  info: 'Info',
}
const iconMap: Record<CardTipo, string> = {
  danger: '⚠',
  warning: '◎',
  info: '○',
}

function SkeletonCard() {
  return (
    <div style={{
      backgroundColor: '#f5f2ee', borderRadius: 14, height: 88,
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

function InsightCard({ card, onClick }: { card: DashboardCard; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const c = colorMap[card.tipo]
  const bg = bgMap[card.tipo]

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: bg,
        border: `1.5px solid ${c}${hovered ? '50' : '25'}`,
        borderRadius: 14,
        padding: '16px 20px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        boxShadow: hovered ? `0 4px 18px ${c}18` : 'none',
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
      }}
    >
      {/* Left dot */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        backgroundColor: c, flexShrink: 0, marginTop: 7,
      }} />

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 14,
          color: c, margin: '0 0 4px',
        }}>
          {card.titulo}
        </p>
        <p style={{
          fontFamily: 'DM Mono, monospace', fontSize: 11.5,
          color: '#3d3834', opacity: 0.75, margin: '0 0 6px',
        }}>
          {card.detalle}
        </p>
        {card.items.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {card.items.slice(0, 3).map((item, i) => (
              <span key={i} style={{
                fontFamily: 'DM Mono, monospace', fontSize: 10.5,
                backgroundColor: c + '12', color: c,
                padding: '2px 8px', borderRadius: 6,
              }}>
                {item}
              </span>
            ))}
            {card.mas > 0 && (
              <span style={{
                fontFamily: 'DM Mono, monospace', fontSize: 10.5,
                color: '#9c958f', padding: '2px 8px',
              }}>
                +{card.mas} más
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <span style={{
          fontFamily: 'DM Mono, monospace', fontSize: 9.5, fontWeight: 700,
          color: c, backgroundColor: c + '18',
          padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
        }}>
          {labelMap[card.tipo]}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onClick() }}
          style={{
            fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 600,
            color: c, backgroundColor: c + '12',
            border: `1px solid ${c}30`,
            padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
            whiteSpace: 'nowrap' as const,
            transition: 'background 0.12s',
          }}
        >
          {card.cta} →
        </button>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [cards, setCards] = useState<DashboardCard[]>([])
  const [loading, setLoading] = useState(true)
  const [generado, setGenerado] = useState<string>('')
  const [showChat, setShowChat] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => {
        setCards(d.cards || [])
        setGenerado(d.generado || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const urgentes = cards.filter(c => c.tipo === 'danger').length
  const avisos = cards.filter(c => c.tipo === 'warning').length

  const asOf = generado
    ? new Date(generado).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''

  function handleCardClick(card: DashboardCard) {
    router.push(card.link)
  }

  return (
    <div style={{ padding: '32px 32px 48px', maxWidth: 800 }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Panel de control</h1>
          <p className="page-subtitle">
            {loading
              ? 'Analizando datos…'
              : cards.length === 0
                ? 'Todo en orden — sin alertas activas'
                : <>
                    {cards.length} alerta{cards.length !== 1 ? 's' : ''} activa{cards.length !== 1 ? 's' : ''}
                    {urgentes > 0 && <> · <span style={{ color: '#dc2626' }}>{urgentes} urgente{urgentes !== 1 ? 's' : ''}</span></>}
                    {avisos > 0 && <> · <span style={{ color: '#d97706' }}>{avisos} aviso{avisos !== 1 ? 's' : ''}</span></>}
                    {asOf && <span style={{ opacity: 0.4 }}> · {asOf}</span>}
                  </>
            }
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true)
            fetch('/api/dashboard')
              .then(r => r.json())
              .then(d => { setCards(d.cards || []); setGenerado(d.generado || '') })
              .catch(() => {})
              .finally(() => setLoading(false))
          }}
          style={{
            fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 600,
            color: '#6b6560', backgroundColor: 'transparent',
            border: '1.5px solid #d8d0c8', borderRadius: 9,
            padding: '6px 14px', cursor: 'pointer',
          }}
        >
          ↻ Actualizar
        </button>
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : cards.length === 0 ? (
        <div style={{
          backgroundColor: '#f0fdf4', border: '1.5px solid #86efac',
          borderRadius: 14, padding: '22px 24px',
          display: 'flex', gap: 14, alignItems: 'center',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#16a34a', flexShrink: 0 }} />
          <div>
            <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 14, color: '#166534', margin: '0 0 2px' }}>
              Todo en orden
            </p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11.5, color: '#166534', opacity: 0.7, margin: 0 }}>
              No hay alertas activas en este momento.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cards.map(card => (
            <InsightCard key={card.id} card={card} onClick={() => handleCardClick(card)} />
          ))}
        </div>
      )}

      {/* Divider + AI Chat toggle */}
      <div style={{ marginTop: 40, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, backgroundColor: '#e8e3dd' }} />
          <button
            onClick={() => {
              setShowChat(v => !v)
              if (!showChat) setTimeout(() => chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
            }}
            style={{
              fontFamily: 'DM Mono, monospace', fontSize: 11.5, fontWeight: 600,
              color: showChat ? '#2563eb' : '#9c958f',
              backgroundColor: showChat ? '#eff6ff' : 'transparent',
              border: `1.5px solid ${showChat ? '#2563eb40' : '#e8e3dd'}`,
              borderRadius: 20, padding: '5px 14px', cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 13 }}>✦</span>
            Asistente IA
            <span style={{ opacity: 0.5, fontSize: 10 }}>{showChat ? '▲' : '▼'}</span>
          </button>
          <div style={{ flex: 1, height: 1, backgroundColor: '#e8e3dd' }} />
        </div>
        {!showChat && (
          <p style={{
            textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 11,
            color: '#b0a8a0', marginTop: 8,
          }}>
            Para consultas que el sistema no puede responder automáticamente
          </p>
        )}
      </div>

      {/* AI Chat — only when toggled open */}
      {showChat && (
        <div ref={chatRef} style={{
          borderRadius: 16, overflow: 'hidden',
          border: '1.5px solid #2563eb20',
          boxShadow: '0 2px 16px #2563eb08',
        }}>
          <KitchenChat />
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
      `}</style>
    </div>
  )
}
