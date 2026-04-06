import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(user.id)

  return NextResponse.json({ ok: true })
}
