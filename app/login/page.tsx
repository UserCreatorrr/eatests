'use client'

import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, Suspense } from 'react'

const ERROR_MESSAGES: Record<string, string> = {
  google_denied: 'Acceso con Google cancelado.',
  google_failed: 'Error al iniciar sesión con Google. Inténtalo de nuevo.',
  google_not_configured: 'Google OAuth no está configurado.',
}

function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const errorKey = searchParams.get('error') || ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(ERROR_MESSAGES[errorKey] || '')
  const [isError, setIsError] = useState(!!errorKey)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    setIsError(false)

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setMsg(data.error || 'Error al procesar la solicitud')
      setIsError(true)
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  function signInWithGoogle() {
    window.location.href = '/api/auth/google'
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #e3dccf',
    fontFamily: 'DM Mono, monospace', fontSize: 13.5, color: '#3d3834', outline: 'none',
    backgroundColor: '#ffffff', boxSizing: 'border-box', transition: 'border-color 0.15s',
  }

  return (
    <div className="mb-login">
      <style>{`
        .mb-login { min-height: 100vh; display: flex; background: #f1ece2; }
        .mb-login__hero {
          position: relative; flex: 1.15; overflow: hidden;
          background: #3d3834; color: #dfd5c9;
          display: flex; flex-direction: column; justify-content: space-between;
          padding: 48px 56px;
        }
        .mb-login__grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(to right, rgba(223,213,201,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(223,213,201,0.05) 1px, transparent 1px);
          background-size: 26px 26px;
          mask-image: radial-gradient(ellipse 90% 80% at 30% 40%, #000 40%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 90% 80% at 30% 40%, #000 40%, transparent 100%);
        }
        .mb-login__glow {
          position: absolute; width: 420px; height: 420px; left: -120px; bottom: -140px;
          background: radial-gradient(circle, rgba(25,249,115,0.16), transparent 70%);
          pointer-events: none;
        }
        .mb-login__form { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 32px; }
        .mb-login__formInner { width: 100%; max-width: 380px; }
        @media (max-width: 880px) {
          .mb-login__hero { display: none; }
          .mb-login { background: #f1ece2; }
        }
      `}</style>

      {/* ── LEFT: brand hero ─────────────────────────────────── */}
      <div className="mb-login__hero">
        <div className="mb-login__grid" />
        <div className="mb-login__glow" />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Image src="/logos/COMPLETE_BICOLOR_NEGATIVE.svg" alt="MarginBite" width={168} height={44} priority />
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 520 }}>
          <h1 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 46, lineHeight: 1.04, letterSpacing: '-0.02em', margin: 0, color: '#f3ede3' }}>
            Controla tu cocina<br />con inteligencia<span style={{ color: '#19f973' }}>.</span>
          </h1>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, lineHeight: 1.9, color: '#dfd5c9', opacity: 0.55, margin: '22px 0 0', letterSpacing: '0.02em' }}>
            Ingredientes · Pedidos · Albaranes<br />
            Proveedores · Escandallos · IA de cocina
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10.5, color: '#dfd5c9', opacity: 0.35, margin: 0, letterSpacing: '0.08em' }}>
            © 2026 MarginBite · Kitchen OS
          </p>
        </div>
      </div>

      {/* ── RIGHT: form ──────────────────────────────────────── */}
      <div className="mb-login__form">
        <div className="mb-login__formInner">
          <div style={{ marginBottom: 28 }}>
            <Image src="/logos/COMPLETE_BICOLOR_POSITIVE.svg" alt="MarginBite" width={150} height={39} />
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11.5, color: '#3d3834', opacity: 0.45, margin: '12px 0 0', letterSpacing: '0.04em' }}>
              Suite para cocinas profesionales
            </p>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, backgroundColor: '#e7e0d4', borderRadius: 12, padding: 4, marginBottom: 22 }}>
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setMsg(''); setIsError(false) }}
                style={{
                  flex: 1, padding: '9px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontFamily: 'DM Mono, monospace', fontSize: 12.5, fontWeight: mode === m ? 600 : 400,
                  backgroundColor: mode === m ? '#ffffff' : 'transparent',
                  color: '#3d3834',
                  boxShadow: mode === m ? '0 1px 3px rgba(61,56,52,0.12)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          {msg && (
            <div style={{
              backgroundColor: isError ? '#fbeae2' : '#d6f9e0',
              border: `1px solid ${isError ? '#a83e1e' : '#0fa651'}`,
              borderRadius: 10, padding: '11px 15px', marginBottom: 16,
            }}>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: isError ? '#a83e1e' : '#0a8f47', margin: 0 }}>
                {msg}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 18 }}>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com" required style={inputStyle}
              onFocus={e => e.currentTarget.style.borderColor = '#19f973'}
              onBlur={e => e.currentTarget.style.borderColor = '#e3dccf'}
            />
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña" required style={inputStyle}
              onFocus={e => e.currentTarget.style.borderColor = '#19f973'}
              onBlur={e => e.currentTarget.style.borderColor = '#e3dccf'}
            />
            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                backgroundColor: '#19f973', color: '#13361f', fontFamily: 'DM Mono, monospace',
                fontSize: 13.5, fontWeight: 700, opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s', marginTop: 3,
              }}
            >
              {loading ? 'Cargando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: '#e3dccf' }} />
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.35 }}>o</span>
            <div style={{ flex: 1, height: 1, backgroundColor: '#e3dccf' }} />
          </div>

          {/* Google */}
          <button
            onClick={signInWithGoogle}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11,
              backgroundColor: '#3d3834', color: '#dfd5c9', border: 'none', borderRadius: 10,
              padding: '13px 20px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 13,
              transition: 'opacity 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.opacity = '0.88')}
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

          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10.5, color: '#3d3834', opacity: 0.3, textAlign: 'center', marginTop: 18 }}>
            Tus datos están aislados y son solo tuyos
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
