import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/server/db/connection'
import { clientIp } from '@/server/http/route'
import { COOKIE_NAME, SESSION_DAYS, cookieOptions, loginWithGoogle } from '@/server/services/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/login?error=google_failed', appUrl))
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${appUrl}/api/auth/google/callback`, grant_type: 'authorization_code' }),
    })
    if (!tokenRes.ok) throw new Error('token exchange failed')
    const tokens = await tokenRes.json()
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } })
    if (!userRes.ok) throw new Error('userinfo failed')
    const g = await userRes.json() as { id: string; email: string; name?: string }
    const s = await loginWithGoogle(getDb(), { sub: g.id, email: g.email, name: g.name ?? null }, { ua: req.headers.get('user-agent') ?? undefined, ip: clientIp(req) })
    const res = NextResponse.redirect(new URL('/dashboard', appUrl))
    res.cookies.set(COOKIE_NAME, s.token, { ...cookieOptions(), maxAge: SESSION_DAYS * 86400 })
    return res
  } catch (e) {
    console.error('[google oauth]', e)
    return NextResponse.redirect(new URL('/login?error=google_failed', appUrl))
  }
}
