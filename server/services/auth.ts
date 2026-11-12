// Autenticación con sesiones revocables.
//
// El JWT lleva el id de sesión (jti). Cada petición comprueba que la sesión
// existe y no está revocada: cerrar sesión la revoca, y el token deja de valer
// aunque alguien lo hubiera copiado. (En la v1 un token robado servía 30 días.)
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'
import type { DB } from '@/server/db/connection'
import { nowIso } from '@/server/domain/dates'
import { ConflictError, UnauthorizedError, ValidationError } from '@/server/domain/errors'
import type { Ctx, Role } from '@/server/http/context'

export const COOKIE_NAME = 'mb_session'
export const SESSION_DAYS = 30

const DEV_SECRET = 'dev-secret-change-me-in-production'

export function jwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s || s === DEV_SECRET) {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET no configurado en producción')
    return new TextEncoder().encode(DEV_SECRET)
  }
  return new TextEncoder().encode(s)
}

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email no válido').max(200),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200),
})
export const registerSchema = credentialsSchema.extend({
  name: z.string().trim().max(120).optional().nullable(),
  orgName: z.string().trim().max(120).optional().nullable(),
})

export interface SessionInfo { token: string; sessionId: string; userId: string; orgId: number; role: Role }

interface UserRow { id: string; email: string; password_hash: string | null; name: string | null }

async function issueSession(db: DB, user: { id: string; email: string }, orgId: number, role: Role, meta: { ua?: string; ip?: string }): Promise<SessionInfo> {
  const sessionId = randomUUID()
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString()
  db.prepare(`INSERT INTO sessions (id, user_id, org_id, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(sessionId, user.id, orgId, expires, meta.ua?.slice(0, 300) ?? null, meta.ip ?? null)
  const token = await new SignJWT({ sub: user.id, org: orgId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(sessionId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(jwtSecret())
  return { token, sessionId, userId: user.id, orgId, role }
}

function primaryMembership(db: DB, userId: string): { org_id: number; role: Role } | undefined {
  return db.prepare(`SELECT org_id, role FROM memberships WHERE user_id = ? ORDER BY created_at LIMIT 1`).get(userId) as any
}

export async function register(db: DB, input: unknown, meta: { ua?: string; ip?: string } = {}): Promise<SessionInfo> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Datos no válidos')
  const { email, password, name, orgName } = parsed.data

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new ConflictError('Este email ya está registrado')

  const userId = randomUUID()
  const hash = bcrypt.hashSync(password, 10)
  const orgId = db.transaction(() => {
    db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(userId, email, hash, name ?? null)
    const org = db.prepare('INSERT INTO organizations (name) VALUES (?)').run(orgName || name || email.split('@')[0])
    const id = Number(org.lastInsertRowid)
    db.prepare(`INSERT INTO memberships (org_id, user_id, role) VALUES (?, ?, 'owner')`).run(id, userId)
    return id
  })()
  return issueSession(db, { id: userId, email }, orgId, 'owner', meta)
}

export async function login(db: DB, input: unknown, meta: { ua?: string; ip?: string } = {}): Promise<SessionInfo> {
  const parsed = credentialsSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Email y contraseña requeridos')
  const { email, password } = parsed.data
  const user = db.prepare('SELECT id, email, password_hash, name FROM users WHERE email = ?').get(email) as UserRow | undefined
  // Mismo mensaje exista o no el usuario: no se revela qué emails hay.
  if (!user?.password_hash || !bcrypt.compareSync(password, user.password_hash)) throw new UnauthorizedError('Credenciales incorrectas')
  const m = primaryMembership(db, user.id)
  if (!m) throw new UnauthorizedError('El usuario no pertenece a ninguna organización')
  return issueSession(db, user, m.org_id, m.role, meta)
}

/** Alta o entrada con Google. Si el email ya existe, se enlaza la cuenta. */
export async function loginWithGoogle(db: DB, g: { sub: string; email: string; name: string | null }, meta: { ua?: string; ip?: string } = {}): Promise<SessionInfo> {
  const email = g.email.toLowerCase().trim()
  let user = db.prepare('SELECT id, email, password_hash, name FROM users WHERE google_sub = ? OR email = ?').get(g.sub, email) as UserRow | undefined
  if (user) {
    db.prepare('UPDATE users SET google_sub = ?, name = COALESCE(name, ?), updated_at = ? WHERE id = ?').run(g.sub, g.name, nowIso(), user.id)
  } else {
    const id = randomUUID()
    db.transaction(() => {
      db.prepare('INSERT INTO users (id, email, name, google_sub) VALUES (?, ?, ?, ?)').run(id, email, g.name, g.sub)
      const org = db.prepare('INSERT INTO organizations (name) VALUES (?)').run(g.name || email.split('@')[0])
      db.prepare(`INSERT INTO memberships (org_id, user_id, role) VALUES (?, ?, 'owner')`).run(Number(org.lastInsertRowid), id)
    })()
    user = { id, email, password_hash: null, name: g.name }
  }
  const m = primaryMembership(db, user.id)!
  return issueSession(db, user, m.org_id, m.role, meta)
}

export function logout(db: DB, sessionId: string): void {
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(nowIso(), sessionId)
}

export function revokeAllSessions(db: DB, userId: string): void {
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(nowIso(), userId)
}

/** Verifica el token y que su sesión siga viva. Devuelve el contexto o null. */
export async function authenticate(db: DB, token: string | undefined): Promise<Ctx | null> {
  if (!token) return null
  let payload: any
  try { ({ payload } = await jwtVerify(token, jwtSecret())) } catch { return null }
  const s = db.prepare(`SELECT s.id, s.user_id, s.org_id, s.expires_at, s.revoked_at, u.email, m.role
                          FROM sessions s JOIN users u ON u.id = s.user_id
                          LEFT JOIN memberships m ON m.user_id = s.user_id AND m.org_id = s.org_id
                         WHERE s.id = ?`).get(payload.jti) as any
  if (!s || s.revoked_at || s.expires_at < nowIso() || !s.role) return null
  return { db, userId: s.user_id, email: s.email, orgId: s.org_id, role: s.role, sessionId: s.id }
}

export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
})
