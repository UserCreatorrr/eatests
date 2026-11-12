// Notificaciones persistentes (campana) y push web. Se generan a partir de
// los avisos: una por tipo y día, para no machacar al usuario.
import { z } from 'zod'
import { nowIso, today } from '@/server/domain/dates'
import { NotFoundError } from '@/server/domain/errors'
import type { Ctx } from '@/server/http/context'
import { computeAlerts } from './alerts'

export interface Notification { id: number; type: string; title: string; body: string | null; urgency: 'low' | 'normal' | 'high'; link: string | null; read_at: string | null; created_at: string }

const SEL = 'SELECT id, type, title, body, urgency, link, read_at, created_at FROM notifications'

export function listNotifications(ctx: Ctx, limit = 30) {
  const rows = ctx.db.prepare(`${SEL} WHERE org_id = ? AND (user_id = ? OR user_id IS NULL) ORDER BY created_at DESC, id DESC LIMIT ?`).all(ctx.orgId, ctx.userId, limit) as Notification[]
  return { notifications: rows, unread: rows.filter(n => !n.read_at).length }
}

export function markRead(ctx: Ctx, id: number): void {
  const r = ctx.db.prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE org_id = ? AND (user_id = ? OR user_id IS NULL) AND id = ?').run(nowIso(), ctx.orgId, ctx.userId, id)
  if (!r.changes) throw new NotFoundError('Notificación no encontrada')
}

export function markAllRead(ctx: Ctx): number {
  return ctx.db.prepare('UPDATE notifications SET read_at = ? WHERE org_id = ? AND (user_id = ? OR user_id IS NULL) AND read_at IS NULL').run(nowIso(), ctx.orgId, ctx.userId).changes
}

const URGENCY: Record<string, Notification['urgency']> = { danger: 'high', warning: 'normal', info: 'low' }

/** Convierte los avisos del día en notificaciones; las de urgencia alta salen también por push. */
export async function generateFromAlerts(ctx: Ctx, push: (userId: string, n: { title: string; body: string; url: string }) => Promise<void> = sendPushToUser): Promise<number> {
  const alerts = computeAlerts(ctx)
  const day = today()
  const exists = ctx.db.prepare(`SELECT 1 FROM notifications WHERE org_id = ? AND (user_id = ? OR user_id IS NULL) AND type = ? AND substr(created_at, 1, 10) = ?`)
  const ins = ctx.db.prepare('INSERT INTO notifications (org_id, user_id, type, title, body, urgency, link) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const created: typeof alerts = []
  ctx.db.transaction(() => {
    for (const a of alerts) {
      if (exists.get(ctx.orgId, ctx.userId, a.id, day)) continue
      ins.run(ctx.orgId, ctx.userId, a.id, a.titulo, a.detalle, URGENCY[a.tipo], a.href ?? null)
      created.push(a)
    }
  })()
  for (const a of created) if (a.tipo === 'danger') await push(ctx.userId, { title: a.titulo, body: a.detalle, url: a.href ?? '/dashboard' }).catch(() => {})
  return created.length
}

// ─── Push ────────────────────────────────────────────────────────────────

export const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) }),
})

export function savePushSubscription(ctx: Ctx, input: unknown): void {
  const d = subscriptionSchema.parse(input)
  ctx.db.prepare(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
                  ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`).run(ctx.userId, d.endpoint, d.keys.p256dh, d.keys.auth)
}

export function removePushSubscription(ctx: Ctx, endpoint: string): void {
  ctx.db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(ctx.userId, endpoint)
}

let vapidReady = false
async function webpush() {
  const mod = await import('web-push')
  const wp = (mod as any).default ?? mod
  if (!vapidReady && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    wp.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@marginbite.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
    vapidReady = true
  }
  return vapidReady ? wp : null
}

export async function sendPushToUser(userId: string, n: { title: string; body: string; url: string }): Promise<void> {
  const wp = await webpush()
  if (!wp) return
  const { getDb } = await import('@/server/db/connection')
  const db = getDb()
  const subs = db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(userId) as { endpoint: string; p256dh: string; auth: string }[]
  for (const s of subs) {
    try {
      await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...n, tag: n.title }))
    } catch (e: any) {
      // Suscripción caducada: se limpia y se sigue con el resto.
      if (e?.statusCode === 410 || e?.statusCode === 404) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(s.endpoint)
    }
  }
}
