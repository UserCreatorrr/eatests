import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { signJwt, setSessionCookie } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/login?error=google_denied', appUrl))
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      throw new Error('Token exchange failed')
    }

    const tokens = await tokenRes.json()

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!userRes.ok) {
      throw new Error('Failed to get user info')
    }

    const googleUser = await userRes.json() as {
      id: string; email: string; name: string
    }

    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(
      googleUser.id, googleUser.email.toLowerCase()
    ) as { id: string; email: string; name: string | null } | undefined

    if (user) {
      // Update google_id if logging in via email user for the first time with Google
      db.prepare('UPDATE users SET google_id = ?, name = COALESCE(name, ?) WHERE id = ?').run(
        googleUser.id, googleUser.name, user.id
      )
    } else {
      const id = randomUUID()
      db.prepare('INSERT INTO users (id, email, name, google_id) VALUES (?, ?, ?, ?)').run(
        id, googleUser.email.toLowerCase(), googleUser.name, googleUser.id
      )
      user = { id, email: googleUser.email.toLowerCase(), name: googleUser.name }
    }

    const token = await signJwt({ id: user.id, email: user.email, name: user.name })
    setSessionCookie(token)

    return NextResponse.redirect(new URL('/dashboard', appUrl))
  } catch (err) {
    console.error('Google OAuth error:', err)
    return NextResponse.redirect(new URL('/login?error=google_failed', appUrl))
  }
}
