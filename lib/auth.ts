import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'

const COOKIE_NAME = 'mb_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me-in-production'
  return new TextEncoder().encode(secret)
}

export type SessionUser = {
  id: string
  email: string
  name: string | null
}

export async function signJwt(user: SessionUser): Promise<string> {
  return await new SignJWT({ id: user.id, email: user.email, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(getSecret())
}

export async function verifyJwt(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: (payload.name as string) || null,
    }
  } catch {
    return null
  }
}

// Server component helper - reads cookie and verifies JWT
export async function getServerUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyJwt(token)
}

// Server component helper - redirects to /login if not authenticated
export async function requireServerUser(): Promise<SessionUser> {
  const user = await getServerUser()
  if (!user) redirect('/login')
  return user
}

// API route helper - reads cookie from request and verifies JWT
export async function getUserFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyJwt(token)
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}
