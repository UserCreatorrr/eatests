'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

function LoginForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const supabase = createSupabaseBrowserClient()

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg(error.message)
      else window.location.href = '/dashboard'
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
      })
      if (error) setMsg(error.message)
      else setMsg('Revisa tu email para confirmar la cuenta.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f2ee', display: 'flex', position: 'relative', overflow: 'hidden' }}>

      {/* Grid texture background */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none' }}>
        <Image src="/logos/grid-negative.png" alt="" fill style={{ objectFit: 'cover' }} />
      </div>

      {/* Left panel - branding */}
      <div style={{ flex: 1, display: 'none', alignItems: 'center', justifyContent: 'center', padding: '60px', position: 'relative' }} className="login-left">
        <div>
          <Image src="/logos/logo-bicolor-negative.svg" alt="MarginBites" width={180} height={48} />
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: '#3d3834', opacity: 0.5, marginTop: '16px', maxWidth: '280px', lineHeight: 1.7 }}>
            Suite de gestion para cocinas profesionales. Control total de tu restaurante con IA.
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <Image src="/logos/logo-bicolor-negative.svg" alt="MarginBites" width={160} height={42} style={{ margin: '0 auto 20px', display: 'block' }} />
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#3d3834', opacity: 0.4 }}>
              Suite de gestion para cocinas profesionales
            </p>
          </div>

          {/* Card */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '32px', border: '1px solid #e8e2db', boxShadow: '0 4px 24px rgba(61,56,52,0.06)' }}>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f5f2ee', borderRadius: '12px', padding: '4px', marginBottom: '28px' }}>
              {(['login', 'signup'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setMsg('') }} style={{
                  flex: 1, padding: '8px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                  fontFamily: 'DM Mono, monospace', fontSize: '12px',
                  backgroundColor: mode === m ? '#ffffff' : 'transparent',
                  color: '#3d3834', fontWeight: mode === m ? 600 : 400,
                  boxShadow: mode === m ? '0 1px 4px rgba(61,56,52,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}>
                  {m === 'login' ? 'Iniciar sesion' : 'Registrarse'}
                </button>
              ))}
            </div>

            {(error || msg) && (
              <div style={{ backgroundColor: msg.includes('email') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.includes('email') ? '#bbf7d0' : '#fecaca'}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: msg.includes('email') ? '#166534' : '#dc2626', margin: 0 }}>
                  {msg || 'Error al iniciar sesion. Intentalo de nuevo.'}
                </p>
              </div>
            )}

            {/* Email form */}
            <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e8e2db', fontFamily: 'DM Mono, monospace', fontSize: '13px', color: '#3d3834', outline: 'none', backgroundColor: '#fafaf9', boxSizing: 'border-box' }}
                onFocus={e => e.currentTarget.style.borderColor = '#19f973'}
                onBlur={e => e.currentTarget.style.borderColor = '#e8e2db'}
              />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Contrasena"
                required
                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e8e2db', fontFamily: 'DM Mono, monospace', fontSize: '13px', color: '#3d3834', outline: 'none', backgroundColor: '#fafaf9', boxSizing: 'border-box' }}
                onFocus={e => e.currentTarget.style.borderColor = '#19f973'}
                onBlur={e => e.currentTarget.style.borderColor = '#e8e2db'}
              />
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '13px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                backgroundColor: '#19f973', color: '#2a2522', fontFamily: 'DM Mono, monospace',
                fontSize: '13px', fontWeight: 600, opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
              }}>
                {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e8e2db' }} />
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#3d3834', opacity: 0.4 }}>o</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e8e2db' }} />
            </div>

            {/* Google */}
            <button onClick={signInWithGoogle} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
              backgroundColor: '#3d3834', color: '#dfd5c9', border: 'none', borderRadius: '12px',
              padding: '13px 20px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '13px',
              transition: 'opacity 0.15s',
            }}
              onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseOut={e => (e.currentTarget.style.opacity = '1')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </button>
          </div>

          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#3d3834', opacity: 0.3, textAlign: 'center', marginTop: '20px' }}>
            Tus datos estan aislados y son solo tuyos
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
