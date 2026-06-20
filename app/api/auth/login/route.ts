import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import db from '@/lib/db'
import { signJwt, setSessionCookie } from '@/lib/auth'
import { rateLimit, getClientIp } from '@/lib/security'

export async function POST(req: NextRequest) {
  try {
    // Anti fuerza bruta: 10 intentos/min por IP.
    if (!rateLimit(`login:${getClientIp(req)}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Demasiados intentos. Espera un minuto.' }, { status: 429 })
    }
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as {
      id: string; email: string; password_hash: string | null; name: string | null
    } | undefined

    if (!user || !user.password_hash) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    const valid = bcrypt.compareSync(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    const token = await signJwt({ id: user.id, email: user.email, name: user.name })
    setSessionCookie(token)

    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
