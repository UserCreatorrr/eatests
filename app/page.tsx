'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type MigrationStatus = 'idle' | 'loading' | 'done' | 'error'

interface MigrationDetails {
  migration_id?: string
  cost_center?: string
  total_proveedores?: number
  total_vendor_details?: number
  total_pedidos_compra?: number
  total_albaranes_compra?: number
  total_facturas_compra?: number
  total_albaranes_venta?: number
  total_facturas_venta?: number
  total_lista_pedidos?: number
  total_ingredientes?: number
  total_herramientas?: number
  message?: string
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<MigrationStatus>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [details, setDetails] = useState<MigrationDetails | null>(null)

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStatus('loading')
    setProgress('Iniciando migración vía n8n... Esto puede tardar varios minutos.')

    try {
      const res = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al conectar')
      }

      setStatus('done')
      setDetails(data.details as MigrationDetails)
    } catch (err) {
      setStatus('error')
      setError((err as Error).message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#3d3834" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logos/logo-negative.svg" alt="MarginBite" className="h-10 w-auto mx-auto mb-5" />
          <p className="text-sm font-mono" style={{ color: "#dfd5c9", opacity: 0.45 }}>Gestión Gastronómica</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 border" style={{ backgroundColor: "#2a2522", borderColor: "rgba(255,255,255,0.08)" }}>
          {status === 'done' ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(25,249,115,0.12)" }}>
                <svg className="w-7 h-7" style={{ color: "#19f973" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-display font-semibold mb-2" style={{ color: "#dfd5c9" }}>¡Migración completada!</h2>
              <p className="text-sm font-mono mb-6" style={{ color: "#dfd5c9", opacity: 0.45 }}>
                {details?.cost_center
                  ? `Centro: ${details.cost_center}`
                  : 'Todos tus datos han sido importados correctamente.'}
              </p>

              {details && !details.message && (
                <div className="text-left rounded-xl p-4 mb-6" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs font-mono font-semibold mb-3" style={{ color: "#dfd5c9", opacity: 0.4, letterSpacing: "0.1em", textTransform: "uppercase" }}>Datos importados:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      ['Proveedores', details.total_proveedores],
                      ['Detalles proveedor', details.total_vendor_details],
                      ['Pedidos compra', details.total_pedidos_compra],
                      ['Albaranes compra', details.total_albaranes_compra],
                      ['Facturas compra', details.total_facturas_compra],
                      ['Albaranes venta', details.total_albaranes_venta],
                      ['Facturas venta', details.total_facturas_venta],
                      ['Lista pedidos', details.total_lista_pedidos],
                      ['Ingredientes', details.total_ingredientes],
                      ['Herramientas', details.total_herramientas],
                    ].filter(([, v]) => v !== undefined).map(([label, value]) => (
                      <div key={label as string} className="flex justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <span className="font-mono text-xs" style={{ color: "#dfd5c9", opacity: 0.45 }}>{label as string}</span>
                        <span className="font-mono text-xs font-semibold" style={{ color: "#dfd5c9" }}>{value as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full font-mono font-semibold py-3 px-6 rounded-xl transition-all text-sm" style={{ backgroundColor: "#19f973", color: "#2a2522" }}
              >
                Ir al Dashboard →
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-display font-semibold mb-1" style={{ color: "#dfd5c9" }}>Importar desde TSpoonLab</h2>
              <p className="text-xs font-mono mb-6" style={{ color: "#dfd5c9", opacity: 0.38 }}>
                Inicia la migración de datos desde TSpoonLab vía n8n.
              </p>

              <form onSubmit={handleImport} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono mb-1.5" style={{ color: "#dfd5c9", opacity: 0.5, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Email de TSpoonLab
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    disabled={status === 'loading'}
                    className="w-full px-4 py-3 rounded-xl text-sm font-mono outline-none transition-all disabled:opacity-40" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#dfd5c9" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono mb-1.5" style={{ color: "#dfd5c9", opacity: 0.5, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={status === 'loading'}
                    className="w-full px-4 py-3 rounded-xl text-sm font-mono outline-none transition-all disabled:opacity-40" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#dfd5c9" }}
                  />
                </div>

                {error && (
                  <div className="text-xs font-mono px-4 py-3 rounded-xl flex items-center gap-2" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}

                {(status === 'loading') && (
                  <div className="text-xs font-mono px-4 py-3 rounded-xl flex items-center gap-3" style={{ backgroundColor: "rgba(25,249,115,0.07)", border: "1px solid rgba(25,249,115,0.15)", color: "#19f973" }}>
                    <svg className="w-4 h-4 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {progress}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full font-mono font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: "#19f973", color: "#2a2522" }}
                >
                  {status === 'loading' ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Importando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Importar datos
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t text-center" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <p className="text-xs font-mono" style={{ color: "#dfd5c9", opacity: 0.28 }}>
                  Tus credenciales se usan solo para la importación y no se almacenan.
                </p>
                {status === 'idle' && (
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="mt-3 text-xs font-mono" style={{ color: "#19f973", opacity: 0.65 }}
                  >
                    Ir al dashboard sin importar →
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
