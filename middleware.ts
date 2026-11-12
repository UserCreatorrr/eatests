// Primera barrera, en el edge: sin un JWT con firma válida no se entra en
// nada que no sea público. La comprobación de que la sesión siga viva (no
// revocada) la hace route() en el servidor, que es quien tiene la BD.
import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC = ['/login', '/api/auth/login', '/api/auth/register', '/api/auth/google', '/api/health', '/api/ingest']
const STATIC = ['/_next', '/fonts', '/logos', '/icons', '/favicon.ico', '/sw.js', '/manifest']

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s || s === 'dev-secret-change-me-in-production') {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET no configurado en producción')
    return new TextEncoder().encode('dev-secret-change-me-in-production')
  }
  return new TextEncoder().encode(s)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some(p => pathname.startsWith(p)) || STATIC.some(p => pathname.startsWith(p)) || /\.(svg|png|ico|webp|woff2?)$/.test(pathname)) {
    return NextResponse.next()
  }
  const token = req.cookies.get('mb_session')?.value
  const isApi = pathname.startsWith('/api/')
  const deny = () => {
    if (isApi) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado', details: {} } }, { status: 401 })
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete('mb_session')
    return res
  }
  if (!token) return deny()
  try { await jwtVerify(token, secret()); return NextResponse.next() } catch { return deny() }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
