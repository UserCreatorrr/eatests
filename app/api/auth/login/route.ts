import { NextResponse } from 'next/server'
import { getDb } from '@/server/db/connection'
import { clientIp, route } from '@/server/http/route'
import { rateLimit } from '@/server/http/ratelimit'
import { COOKIE_NAME, SESSION_DAYS, cookieOptions, login } from '@/server/services/auth'

export const dynamic = 'force-dynamic'

export const POST = route({ public: true }, async ({ req }) => {
  // Dos frenos: por IP y por cuenta, para que rotar la IP no sirva para
  // machacar un email concreto.
  rateLimit(`login:${clientIp(req)}`, 10, 60_000, 'Demasiados intentos. Espera un minuto')
  let body: any
  try { body = await req.json() } catch { body = {} }
  if (typeof body?.email === 'string') rateLimit(`login-acct:${body.email.toLowerCase().trim()}`, 10, 300_000, 'Demasiados intentos para esta cuenta. Espera unos minutos')
  const s = await login(getDb(), body, { ua: req.headers.get('user-agent') ?? undefined, ip: clientIp(req) })
  const res = NextResponse.json({ ok: true, user: { id: s.userId, orgId: s.orgId, role: s.role } })
  res.cookies.set(COOKIE_NAME, s.token, { ...cookieOptions(), maxAge: SESSION_DAYS * 86400 })
  return res
})
