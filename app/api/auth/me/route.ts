import { z } from 'zod'
import { nowIso } from '@/server/domain/dates'
import { route } from '@/server/http/route'

export const dynamic = 'force-dynamic'

const select = `SELECT u.id, u.email, u.name, u.avatar_url AS avatar, u.created_at, o.id AS org_id, o.name AS org_name, m.role
                FROM users u JOIN memberships m ON m.user_id = u.id JOIN organizations o ON o.id = m.org_id
                WHERE u.id = ? AND o.id = ?`

export const GET = route({}, ({ ctx }) => ({ user: ctx.db.prepare(select).get(ctx.userId, ctx.orgId) }))

const patchSchema = z.object({
  name: z.string().trim().max(120).optional(),
  // El avatar viaja en cada /api/auth/me: tope ~500 KB reales en base64.
  avatar: z.string().max(700_000).nullable().optional(),
  orgName: z.string().trim().min(1).max(120).optional(),
})

export const PATCH = route({ body: patchSchema }, ({ ctx, body }) => {
  if (body.name !== undefined || body.avatar !== undefined) {
    ctx.db.prepare('UPDATE users SET name = COALESCE(?, name), avatar_url = CASE WHEN ? THEN ? ELSE avatar_url END, updated_at = ? WHERE id = ?')
      .run(body.name ?? null, body.avatar !== undefined ? 1 : 0, body.avatar ?? null, nowIso(), ctx.userId)
  }
  if (body.orgName !== undefined && ctx.role === 'owner') {
    ctx.db.prepare('UPDATE organizations SET name = ? WHERE id = ?').run(body.orgName, ctx.orgId)
  }
  return { user: ctx.db.prepare(select).get(ctx.userId, ctx.orgId) }
})
