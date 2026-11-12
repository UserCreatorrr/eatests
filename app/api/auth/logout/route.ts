import { NextResponse } from 'next/server'
import { route } from '@/server/http/route'
import { COOKIE_NAME, cookieOptions, logout } from '@/server/services/auth'

export const dynamic = 'force-dynamic'

// Revoca la sesión en la BD: el token deja de valer aunque alguien lo copiara.
export const POST = route({}, ({ ctx }) => {
  logout(ctx.db, ctx.sessionId)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 })
  return res
})
