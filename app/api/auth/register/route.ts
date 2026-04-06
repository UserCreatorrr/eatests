import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { signJwt, setSessionCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim())
    if (existing) {
      return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 409 })
    }

    const id = randomUUID()
    const hash = bcrypt.hashSync(password, 10)
    db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(
      id, email.toLowerCase().trim(), hash, name || null
    )

    const token = await signJwt({ id, email: email.toLowerCase().trim(), name: name || null })
    setSessionCookie(token)

    return NextResponse.json({ ok: true, user: { id, email, name } })
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
