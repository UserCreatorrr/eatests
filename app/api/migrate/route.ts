import { NextRequest, NextResponse } from 'next/server'

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'https://marginbites-n8n.ps8uzx.easypanel.host/webhook-test/34f8720f-8faa-416c-bb5e-f4ea1d54686f'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
    }

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`n8n error (${response.status}): ${text}`)
    }

    const result = await response.json()
    // n8n responds with an array of items when using "Respond to Webhook"
    const details = Array.isArray(result) ? result[0] : result

    return NextResponse.json({ success: true, details })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
