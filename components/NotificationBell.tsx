'use client'

import { useState, useEffect, useRef } from 'react'

type Notification = {
  id: number
  type: string
  title: string
  body: string | null
  urgency: 'alta' | 'media' | 'baja'
  link: string | null
  read: number
  created_at: string
}

const urgencyColor: Record<string, string> = {
  alta: '#dc2626',
  media: '#d97706',
  baja: '#16a34a',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return `hace ${Math.floor(hrs / 24)}d`
}

async function registerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const res = await fetch('/api/push/vapid-key').then(r => r.json())
    if (!res.publicKey) return

    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      // Already subscribed, just ensure it's saved server-side
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(existing.toJSON()),
      })
      return
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(res.publicKey),
    })

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
  } catch (e) {
    // Push not available in this context, ignore
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  async function load() {
    const res = await fetch('/api/notifications').then(r => r.json()).catch(() => null)
    if (res?.notifications) {
      setNotifications(res.notifications)
      setUnread(res.unread)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetch('/api/notifications', { method: 'POST' }).catch(() => {}).finally(() => load())
    registerPush()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markRead(id: number) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' }).catch(() => {})
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'PATCH' }).catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })))
    setUnread(0)
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.read) await markRead(n.id)
    if (n.link) {
      setOpen(false)
      window.location.href = n.link
    } else {
      setOpen(false)
    }
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Notificaciones"
        style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          backgroundColor: open ? 'rgba(25,249,115,0.08)' : 'rgba(255,255,255,0.04)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#dfd5c9', opacity: 0.7, position: 'relative',
        }}
      >
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            backgroundColor: '#dc2626', color: '#fff',
            borderRadius: '50%', width: 14, height: 14,
            fontSize: 9, fontFamily: 'DM Mono, monospace', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 60, left: 16, zIndex: 1000,
          width: 340, maxHeight: 480,
          backgroundColor: '#faf9f7', border: '1px solid #e8e2db',
          borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 12px', borderBottom: '1px solid #e8e2db', flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 13, color: '#3d3834' }}>
              Notificaciones
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#19f973', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Marcar todas leidas
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3d3834', opacity: 0.4, display: 'flex', alignItems: 'center', padding: 0 }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.4 }}>
                Cargando...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.4 }}>
                Sin notificaciones activas
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: n.read ? '#fff' : '#fffef9',
                    borderLeft: `3px solid ${urgencyColor[n.urgency] || '#d97706'}`,
                    borderBottom: '1px solid #f0ebe4',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 3,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{
                      fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 12,
                      color: urgencyColor[n.urgency] || '#d97706', flex: 1,
                    }}>
                      {n.title}
                    </span>
                    {!n.read && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: urgencyColor[n.urgency], flexShrink: 0, marginTop: 3 }} />
                    )}
                  </div>
                  {n.body && (
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.55 }}>
                      {n.body}
                    </span>
                  )}
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.35 }}>
                    {timeAgo(n.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
