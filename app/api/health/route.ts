import { NextResponse } from 'next/server'
import { getDb } from '@/server/db/connection'

export const dynamic = 'force-dynamic'

// Sin datos de negocio: solo si la app responde y la BD contesta.
export async function GET() {
  try {
    const db = getDb()
    const m = db.prepare('SELECT MAX(id) AS v FROM schema_migrations').get() as any
    return NextResponse.json({ ok: true, schema: m?.v ?? 0, version: process.env.GIT_SHA?.slice(0, 7) ?? 'dev', time: new Date().toISOString() })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 503 })
  }
}
