'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const supabase = createSupabaseBrowserClient()

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f2ee', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: '#19f973', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#2a2522" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h1 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: '28px', color: '#3d3834', margin: '0 0 6px' }}>
            MarginBites
          </h1>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#3d3834', opacity: 0.45 }}>
            Suite de gestion para cocinas profesionales
          </p>
        </div>

        {/* Card */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '32px', border: '1px solid #e8e2db' }}>
          <h2 style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: '18px', color: '#3d3834', margin: '0 0 6px' }}>
            Accede a tu cocina
          </h2>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#3d3834', opacity: 0.45, margin: '0 0 28px' }}>
            Inicia sesion con tu cuenta de Google
          </p>

          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#dc2626', margin: 0 }}>
                Error al iniciar sesion. Intentalo de nuevo.
              </p>
            </div>
          )}

          <button
            onClick={signInWithGoogle}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
              backgroundColor: '#3d3834', color: '#dfd5c9', border: 'none', borderRadius: '12px',
              padding: '14px 20px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '13px',
              fontWeight: 500, transition: 'opacity 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseOut={e => (e.currentTarget.style.opacity = '1')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
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
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
