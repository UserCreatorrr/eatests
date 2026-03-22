'use client'

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4 shadow-lg">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">EatEsts</h1>
          <p className="text-slate-500 mt-1">Gestión Gastronómica</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {status === 'done' ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">¡Migración completada!</h2>
              <p className="text-slate-500 mb-6">
                {details?.cost_center
                  ? `Centro: ${details.cost_center}`
                  : 'Todos tus datos han sido importados a EatEsts.'}
              </p>

              {details && !details.message && (
                <div className="text-left bg-slate-50 rounded-xl p-4 mb-6">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Datos importados:</p>
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
                      <div key={label as string} className="flex justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                        <span className="text-slate-500">{label as string}</span>
                        <span className="font-semibold text-slate-800">{value as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Ir al Dashboard →
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Importar desde TSpoonLab</h2>
              <p className="text-slate-500 text-sm mb-6">
                Inicia la migración de datos desde TSpoonLab a EatEsts vía n8n.
              </p>

              <form onSubmit={handleImport} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email de TSpoonLab
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    disabled={status === 'loading'}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={status === 'loading'}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 transition"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}

                {(status === 'loading') && (
                  <div className="bg-blue-50 border border-blue-100 text-blue-700 text-sm px-4 py-3 rounded-xl flex items-center gap-3">
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
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
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

              <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400">
                  Tus credenciales se usan solo para la importación y no se almacenan.
                </p>
                {status === 'idle' && (
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
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
