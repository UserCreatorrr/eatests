'use client'

import { useState, useEffect, useRef } from 'react'
import { tk, ff } from '@/lib/design'

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
  alta: tk.terra,
  media: tk.clay,
  baja: tk.appleDeep,
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

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
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
          width: 28, height: 28, flexShrink: 0,
          backgroundColor: open ? 'rgba(25,249,115,0.10)' : 'rgba(255,255,255,0.04)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: tk.cream, opacity: 0.7, position: 'relative',
        }}
      >
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            backgroundColor: tk.terra, color: tk.cream,
            width: 14, height: 14,
            fontSize: 9, fontFamily: ff.mono, fontWeight: 700,
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
          backgroundColor: tk.paper, border: `1.5px solid ${tk.iron}`,
          boxShadow: '0 8px 32px rgba(61,56,52,0.22)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: `1.5px solid ${tk.iron20}`, flexShrink: 0,
            background: tk.iron,
          }}>
            <span style={{ fontFamily: ff.mono, fontWeight: 400, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: tk.apple }}>
              Notificaciones
            </span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  style={{ fontFamily: ff.mono, fontSize: 10, color: tk.cream, opacity: 0.7, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Marcar todas leídas
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: tk.cream, opacity: 0.5, display: 'flex', alignItems: 'center', padding: 0 }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', fontFamily: ff.mono, fontSize: 11, color: tk.iron40 }}>
                Cargando…
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontFamily: ff.mono, fontSize: 11, color: tk.iron40 }}>
                Sin notificaciones activas
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: n.read ? tk.paper : tk.cream,
                    borderLeft: `3px solid ${urgencyColor[n.urgency] || tk.clay}`,
                    borderBottom: `1px solid ${tk.iron20}`,
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 3,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{
                      fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 12.5,
                      color: tk.iron, flex: 1,
                    }}>
                      {n.title}
                    </span>
                    {!n.read && (
                      <span style={{ width: 6, height: 6, backgroundColor: urgencyColor[n.urgency], flexShrink: 0, marginTop: 4 }} />
                    )}
                  </div>
                  {n.body && (
                    <span style={{ fontFamily: ff.mono, fontSize: 10, color: tk.iron60 }}>
                      {n.body}
                    </span>
                  )}
                  <span style={{ fontFamily: ff.mono, fontSize: 10, color: tk.iron40 }}>
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
