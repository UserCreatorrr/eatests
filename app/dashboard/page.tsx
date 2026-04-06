'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import KitchenChat from '@/components/KitchenChat'

export default function CocinaPage() {
  const [urgentes, setUrgentes] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(data => {
        const count = (data.notifications || []).filter((n: any) => n.urgency === 'alta' && !n.read).length
        setUrgentes(count)
      })
      .catch(() => {})
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {urgentes > 0 && !dismissed && (
        <div style={{
          margin: '12px 16px 0',
          backgroundColor: '#fef2f2',
          border: '1px solid #dc2626',
          borderRadius: 12,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#dc2626' }}>
            Tienes {urgentes} alerta{urgentes > 1 ? 's' : ''} urgente{urgentes > 1 ? 's' : ''}{' '}
            <a href="/dashboard/alertas" style={{ color: '#dc2626', fontWeight: 700, textDecoration: 'underline' }}>
              Ver alertas
            </a>
          </span>
          <button
            onClick={() => setDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', opacity: 0.6, display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0 }}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <KitchenChat />
    </div>
  )
}
