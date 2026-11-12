// Invoca las rutas de Next como lo haría el servidor, contra una BD en memoria.
import { NextRequest } from 'next/server'
import { openDatabase, useDatabase, type DB } from '@/server/db/connection'
import { COOKIE_NAME, register } from '@/server/services/auth'

export type Handler = (req: NextRequest, ctx?: { params?: Record<string, string> }) => Promise<Response>

export function freshDb(): DB {
  const db = openDatabase(':memory:')
  useDatabase(db)
  return db
}

export async function signUp(db: DB, email = 'ana@test.com'): Promise<string> {
  const s = await register(db, { email, password: 'secreta123', name: 'Ana' })
  return `${COOKIE_NAME}=${s.token}`
}

export async function call(handler: Handler, opts: { method?: string; path?: string; body?: unknown; cookie?: string; params?: Record<string, string> } = {}) {
  const url = new URL(opts.path ?? '/api/x', 'http://test.local')
  const headers: Record<string, string> = {}
  if (opts.cookie) headers.cookie = opts.cookie
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  const req = new NextRequest(url, { method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'), headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined })
  const res = await handler(req, { params: opts.params ?? {} })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* no json */ }
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') }
}
