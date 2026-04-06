import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getUserFromRequest(req)
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  // Return full user including avatar
  const user = db.prepare('SELECT id, email, name, avatar, created_at FROM users WHERE id = ?').get(session.id)
  return NextResponse.json({ user })
}

export async function PATCH(req: NextRequest) {
  const session = await getUserFromRequest(req)
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { name, avatar } = body

  const updates: string[] = []
  const values: unknown[] = []

  if (name !== undefined) { updates.push('name = ?'); values.push(name) }
  if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar) }

  if (updates.length === 0) return NextResponse.json({ error: 'Sin cambios' }, { status: 400 })

  values.push(session.id)
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  const updated = db.prepare('SELECT id, email, name, avatar, created_at FROM users WHERE id = ?').get(session.id)
  return NextResponse.json({ user: updated })
}
