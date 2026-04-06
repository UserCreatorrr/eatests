/**
 * POST /api/migrate
 * Triggered by the user from the app. Sends TSpoonLab credentials + user_id to n8n.
 * n8n fetches all data and POSTs back to /api/ingest.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'https://marginbites-n8n.ps8uzx.easypanel.host/webhook/34f8720f-8faa-416c-bb5e-f4ea1d54686f'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña de TSpoonLab requeridos' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tspoon_email: email,
        tspoon_password: password,
        user_id: user.id,
        ingest_url: `${appUrl}/api/ingest`,
        ingest_secret: process.env.INGEST_SECRET || '',
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`n8n error (${response.status}): ${text}`)
    }

    return NextResponse.json({ ok: true, message: 'Migración iniciada. Los datos aparecerán en unos minutos.' })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
