import { NextResponse } from 'next/server'
import { getDb } from '@/server/db/connection'
import { clientIp, route } from '@/server/http/route'
import { rateLimit } from '@/server/http/ratelimit'
import { COOKIE_NAME, SESSION_DAYS, cookieOptions, register } from '@/server/services/auth'

export const dynamic = 'force-dynamic'

export const POST = route({ public: true }, async ({ req }) => {
  rateLimit(`register:${clientIp(req)}`, 5, 600_000, 'Demasiados registros. Inténtalo más tarde')
  let body: unknown
  try { body = await req.json() } catch { body = {} }
  const s = await register(getDb(), body, { ua: req.headers.get('user-agent') ?? undefined, ip: clientIp(req) })
  const res = NextResponse.json({ ok: true, user: { id: s.userId, orgId: s.orgId, role: s.role } })
  res.cookies.set(COOKIE_NAME, s.token, { ...cookieOptions(), maxAge: SESSION_DAYS * 86400 })
  return res
})
