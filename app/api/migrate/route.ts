/**
 * POST /api/migrate
 * Sends TSpoonLab credentials + user_id to n8n which fetches all data and POSTs to /api/ingest.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'https://esencia-paradise-n8n.rh6pum.easypanel.host/webhook-test/34f8720f-8faa-416c-bb5e-f4ea1d54686f'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contrasena de TSpoonLab requeridos' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
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
      throw new Error(`n8n error (${response.status}): ${text.slice(0, 200)}`)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
