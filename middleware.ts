import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/ingest', '/api/health', '/api/admin/seed-demo']

const DEV_FALLBACK_SECRET = 'dev-secret-change-me-in-production'

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret === DEV_FALLBACK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET no configurado en producción.')
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET)
  }
  return new TextEncoder().encode(secret)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/logos') ||
    pathname.startsWith('/icons') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next()
  }

  // Check session cookie
  const token = request.cookies.get('mb_session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(token, getSecret())
    return NextResponse.next()
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('mb_session')
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts|logos|icons|.*\\.svg).*)'],
}
