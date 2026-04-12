import { NextRequest, NextResponse } from 'next/server'
import { getOAuth2Client } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

// GET /api/email/auth  → redirects to Google OAuth consent screen
export async function GET(_req: NextRequest) {
  const oauth2Client = getOAuth2Client()
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.send'],
    prompt: 'consent', // always return refresh_token
  })
  return NextResponse.redirect(authUrl)
}
