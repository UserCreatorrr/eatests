import { NextRequest, NextResponse } from 'next/server'

// Legacy Supabase callback route - redirect to dashboard
// Google OAuth now uses /api/auth/google/callback
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/dashboard`)
}
