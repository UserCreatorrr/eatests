import { NextRequest, NextResponse } from 'next/server'
import { getStoredTokens } from '@/lib/gmail'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tokens = getStoredTokens()
  return NextResponse.json({ configured: !!(tokens?.refresh_token) })
}
