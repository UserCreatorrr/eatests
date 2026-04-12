import { NextRequest, NextResponse } from 'next/server'
import { getOAuth2Client, storeTokens } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

// GET /api/email/callback  → Google OAuth callback, stores refresh token
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL('/dashboard?gmail=error', req.url))
  }
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  try {
    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)
    storeTokens(tokens)
    return NextResponse.redirect(new URL('/dashboard?gmail=ok', req.url))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
