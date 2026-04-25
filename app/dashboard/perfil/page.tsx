'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type UserData = {
  id: string
  email: string
  name: string | null
  avatar: string | null
  created_at: string
}

type MigrateStatus = 'idle' | 'loading' | 'success' | 'error'

const S: Record<string, React.CSSProperties> = {
  section: { backgroundColor: '#fff', borderRadius: 20, padding: '28px 32px', border: '1px solid #e8e2db', marginBottom: 20 },
  label: { fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.55, display: 'block', marginBottom: 6 },
  input: { width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e8e2db', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#3d3834', outline: 'none', boxSizing: 'border-box' as const, backgroundColor: '#fafaf9' },
  btn: { padding: '11px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600 },
}

export default function PerfilPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg] = useState('')

  const [tspoonEmail, setTspoonEmail] = useState('')
  const [tspoonPass, setTspoonPass] = useState('')
  const [migrateStatus, setMigrateStatus] = useState<MigrateStatus>('idle')
  const [migrateMsg, setMigrateMsg] = useState('')
  const [migrateLog, setMigrateLog] = useState<string[]>([])

  const avatarRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) {
        setUser(d.user)
        setName(d.user.name || '')
      }
    })
  }, [])

  async function saveName() {
    if (!name.trim()) return
    setSavingName(true)
    setNameMsg('')
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    const d = await res.json()
    if (res.ok) { setUser(d.user); setNameMsg('Guardado') }
    else setNameMsg(d.error || 'Error')
    setSavingName(false)
    setTimeout(() => setNameMsg(''), 2000)
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Max 2MB'); return }
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: dataUrl }),
      })
      const d = await res.json()
      if (res.ok) setUser(d.user)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function startMigration() {
    if (!tspoonEmail || !tspoonPass) {
      setMigrateMsg('Introduce el email y contrasena de TSpoonLab')
      return
    }
    setMigrateStatus('loading')
    setMigrateMsg('')
    setMigrateLog(['Conectando con n8n...'])

    try {
      const res = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tspoonEmail, password: tspoonPass }),
      })
      const d = await res.json()

      if (!res.ok) throw new Error(d.error || 'Error al iniciar migracion')

      setMigrateLog(prev => [...prev, 'Workflow iniciado en n8n', 'Autenticando en TSpoonLab...', 'Importando datos (esto puede tardar 1-2 minutos)...'])

      // Poll /api/health to detect when data arrives
      let attempts = 0
      const interval = setInterval(async () => {
        attempts++
        const h = await fetch('/api/health').then(r => r.json()).catch(() => null)
        const total = h?.tables ? Object.values(h.tables as Record<string, number>).reduce((a: number, b: unknown) => a + (typeof b === 'number' ? b : 0), 0) : 0

        if (total > 0) {
          clearInterval(interval)
          setMigrateLog(prev => [...prev, `Datos recibidos: ${total} registros importados`])
          setMigrateStatus('success')
          setMigrateMsg(`Migracion completada. ${total} registros importados.`)
        } else if (attempts >= 24) { // 2 min timeout
          clearInterval(interval)
          setMigrateStatus('success')
          setMigrateMsg('Migracion iniciada. Recarga las paginas en unos minutos para ver los datos.')
        } else {
          setMigrateLog(prev => {
            const last = prev[prev.length - 1]
            if (last.startsWith('Esperando datos')) {
              return [...prev.slice(0, -1), `Esperando datos... (${attempts * 5}s)`]
            }
            return [...prev, `Esperando datos... (${attempts * 5}s)`]
          })
        }
      }, 5000)
    } catch (err: any) {
      setMigrateStatus('error')
      setMigrateMsg(err.message)
      setMigrateLog(prev => [...prev, `Error: ${err.message}`])
    }
  }

  if (!user) {
    return <div className="p-8"><p className="page-subtitle">Cargando...</p></div>
  }

  return (
    <div className="p-8" style={{ maxWidth: 680 }}>
      <div className="page-header">
        <h1 className="page-title">Perfil y Ajustes</h1>
        <p className="page-subtitle">{user.email}</p>
      </div>

      {/* Avatar + Name */}
      <div style={S.section}>
        <h2 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 15, color: '#3d3834', margin: '0 0 24px' }}>Datos de usuario</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 28 }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              onClick={() => avatarRef.current?.click()}
              style={{
                width: 80, height: 80, borderRadius: '50%', cursor: 'pointer',
                backgroundColor: '#19f973', display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', border: '3px solid #e8e2db',
              }}
              title="Cambiar foto de perfil"
            >
              {user.avatar ? (
                <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 28, color: '#2a2522' }}>
                  {(user.name || user.email)[0].toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: '50%', backgroundColor: '#3d3834', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatar} />
          </div>

          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.45, margin: '0 0 3px' }}>
              Haz clic en la imagen para cambiar tu foto de perfil (max 2MB)
            </p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.6, margin: 0 }}>
              {user.email}
            </p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.35, margin: '4px 0 0' }}>
              Miembro desde {new Date(user.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        {/* Name */}
        <div>
          <label style={S.label}>Nombre</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              placeholder="Tu nombre"
              style={{ ...S.input, flex: 1 }}
              onFocus={e => (e.currentTarget.style.borderColor = '#19f973')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e8e2db')}
            />
            <button
              onClick={saveName}
              disabled={savingName}
              style={{ ...S.btn, backgroundColor: '#19f973', color: '#2a2522', opacity: savingName ? 0.6 : 1 }}
            >
              {savingName ? '...' : 'Guardar'}
            </button>
          </div>
          {nameMsg && (
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: nameMsg === 'Guardado' ? '#16a34a' : '#dc2626', marginTop: 6 }}>
              {nameMsg}
            </p>
          )}
        </div>
      </div>

      {/* Migration */}
      <div style={S.section}>
        <h2 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 15, color: '#3d3834', margin: '0 0 6px' }}>
          Migracion desde TSpoonLab
        </h2>
        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.5, margin: '0 0 24px' }}>
          Importa todos tus datos (ingredientes, proveedores, pedidos, albaranes y facturas) directamente desde tu cuenta de TSpoonLab.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={S.label}>Email de TSpoonLab</label>
            <input
              type="email"
              value={tspoonEmail}
              onChange={e => setTspoonEmail(e.target.value)}
              placeholder="usuario@restaurante.com"
              disabled={migrateStatus === 'loading'}
              style={S.input}
              onFocus={e => (e.currentTarget.style.borderColor = '#19f973')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e8e2db')}
            />
          </div>
          <div>
            <label style={S.label}>Contrasena de TSpoonLab</label>
            <input
              type="password"
              value={tspoonPass}
              onChange={e => setTspoonPass(e.target.value)}
              placeholder="••••••••"
              disabled={migrateStatus === 'loading'}
              style={S.input}
              onFocus={e => (e.currentTarget.style.borderColor = '#19f973')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e8e2db')}
            />
          </div>

          <button
            onClick={startMigration}
            disabled={migrateStatus === 'loading'}
            style={{
              ...S.btn,
              backgroundColor: migrateStatus === 'success' ? '#16a34a' : migrateStatus === 'error' ? '#dc2626' : '#3d3834',
              color: '#dfd5c9',
              opacity: migrateStatus === 'loading' ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
            }}
          >
            {migrateStatus === 'loading' ? (
              <>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Importando datos...
              </>
            ) : migrateStatus === 'success' ? (
              'Migracion completada'
            ) : (
              'Iniciar importacion de TSpoonLab'
            )}
          </button>
        </div>

        {/* Log */}
        {migrateLog.length > 0 && (
          <div style={{ marginTop: 20, backgroundColor: '#f5f2ee', borderRadius: 12, padding: '16px 18px' }}>
            {migrateLog.map((line, i) => (
              <p key={i} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.7, margin: i === 0 ? 0 : '5px 0 0' }}>
                {i === migrateLog.length - 1 ? '> ' : '  '}{line}
              </p>
            ))}
          </div>
        )}

        {migrateMsg && (
          <div style={{
            marginTop: 16, borderRadius: 12, padding: '12px 16px',
            backgroundColor: migrateStatus === 'error' ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${migrateStatus === 'error' ? '#fecaca' : '#bbf7d0'}`,
          }}>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: migrateStatus === 'error' ? '#dc2626' : '#166534', margin: 0 }}>
              {migrateMsg}
            </p>
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>

      {/* Account info */}
      <div style={S.section}>
        <h2 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 15, color: '#3d3834', margin: '0 0 20px' }}>Cuenta</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'ID de usuario', value: user.id },
            { label: 'Email', value: user.email },
            { label: 'Fecha de registro', value: new Date(user.created_at).toLocaleString('es-ES') },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid #f5f2ee' }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.5 }}>{label}</span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', maxWidth: 320, textAlign: 'right', wordBreak: 'break-all' as const }}>{value}</span>
            </div>
          ))}
        </div>

        <button
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.push('/login')
          }}
          style={{
            width: '100%', padding: '13px 22px', borderRadius: 14, border: '1.5px solid #fca5a5',
            backgroundColor: '#fff1f2', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 10, fontFamily: 'DM Mono, monospace', fontSize: 13,
            fontWeight: 600, color: '#dc2626',
          }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
