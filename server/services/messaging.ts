// Envío de pedidos por email (Gmail OAuth) y WhatsApp (Evolution API).
// El pedido se crea por purchasing y queda "enviado" solo si el envío salió.
// El token de Gmail se guarda cifrado; el transporte se inyecta en tests.
import { z } from 'zod'
import { decrypt, encrypt, isEncrypted } from '@/server/adapters/crypto'
import { ValidationError } from '@/server/domain/errors'
import type { Ctx } from '@/server/http/context'
import { getSupplier } from './catalog'
import { createOrder, setOrderStatus, type Order, type OrderLine } from './purchasing'
import type { DB } from '@/server/db/connection'

// ─── Gmail ───────────────────────────────────────────────────────────────

const TOKENS_KEY = 'gmail_tokens'

export function getGmailTokens(db: DB): any | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(TOKENS_KEY) as { value: string } | undefined
  if (!row) return null
  try {
    if (isEncrypted(row.value)) return JSON.parse(decrypt(row.value))
    // Herencia v1 en claro: se cifra en cuanto se lee por primera vez.
    const tokens = JSON.parse(row.value)
    storeGmailTokens(db, tokens)
    return tokens
  } catch { return null }
}

export function storeGmailTokens(db: DB, tokens: unknown): void {
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(TOKENS_KEY, encrypt(JSON.stringify(tokens)))
}

export function gmailConfigured(db: DB): boolean {
  return !!getGmailTokens(db)?.refresh_token
}

export function oauthClient() {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001').replace(/\/$/, '')
  // Import diferido: googleapis pesa y solo hace falta aquí.
  const { google } = require('googleapis') as typeof import('googleapis')
  return { google, client: new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, `${base}/api/messaging/email/callback`) }
}

export type EmailTransport = (msg: { to: string; subject: string; html: string; text: string }) => Promise<void>

export const gmailTransport: EmailTransport = async msg => {
  const { getDb } = await import('@/server/db/connection')
  const db = getDb()
  const tokens = getGmailTokens(db)
  if (!tokens?.refresh_token) throw new ValidationError('Gmail no está conectado: conéctalo desde Ajustes')
  const { google, client } = oauthClient()
  client.setCredentials(tokens)
  if (tokens.expiry_date && Date.now() > tokens.expiry_date - 60_000) {
    const { credentials } = await client.refreshAccessToken()
    const merged = { ...tokens, ...credentials }
    storeGmailTokens(db, merged)
    client.setCredentials(merged)
  }
  const gmail = google.gmail({ version: 'v1', auth: client })
  const boundary = `mb_${Date.now()}`
  const raw = [
    `To: ${msg.to}`, `Subject: =?UTF-8?B?${Buffer.from(msg.subject).toString('base64')}?=`, 'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', Buffer.from(msg.text).toString('base64'), '',
    `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', Buffer.from(msg.html).toString('base64'), '', `--${boundary}--`,
  ].join('\r\n')
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: Buffer.from(raw).toString('base64url') } })
}

// ─── WhatsApp ────────────────────────────────────────────────────────────

export type WhatsAppTransport = (phone: string, text: string) => Promise<void>

export const evolutionTransport: WhatsAppTransport = async (phone, text) => {
  const base = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, ''), key = process.env.EVOLUTION_API_KEY || '', instance = process.env.EVOLUTION_INSTANCE || ''
  if (!base || !key || !instance) throw new ValidationError('WhatsApp no configurado (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE)')
  const res = await fetch(`${base}/message/sendText/${instance}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key }, body: JSON.stringify({ number: phone, text }) })
  if (!res.ok) throw new Error(`Evolution API ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

export function normalizePhone(raw: string): string {
  const p = raw.replace(/[\s\-().+]/g, '')
  if (!/^\d{9,15}$/.test(p)) throw new ValidationError('Teléfono no válido: usa prefijo de país y solo dígitos')
  return p.length === 9 ? `34${p}` : p
}

// ─── Envío de pedidos ────────────────────────────────────────────────────

export const sendOrderSchema = z.object({
  supplierId: z.number().int().positive(),
  channel: z.enum(['email', 'whatsapp']),
  to: z.string().trim().max(200).optional().nullable(),
  subject: z.string().trim().max(200).optional().nullable(),
  message: z.string().trim().min(1, 'El mensaje está vacío').max(5000),
  items: z.array(z.object({ ingredientId: z.number().int().positive().optional().nullable(), description: z.string().trim().min(1).max(200), qty: z.number().positive(), unit: z.string().optional().nullable() })).min(1, 'El pedido no tiene artículos'),
  expectedDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export function orderEmailHtml(opts: { supplier: string; message: string; items: { description: string; qty: number; unit?: string | null }[]; appUrl: string; number: string }): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
  const rows = opts.items.map(i => `<tr><td style="padding:10px 16px;border-bottom:1px solid #eee;font-family:Helvetica,Arial,sans-serif;font-size:14px">${esc(i.description)}</td><td style="padding:10px 16px;border-bottom:1px solid #eee;font-family:Helvetica,Arial,sans-serif;font-size:14px;text-align:right;white-space:nowrap"><b>${i.qty}${i.unit ? ' ' + esc(i.unit) : ''}</b></td></tr>`).join('')
  const paragraphs = esc(opts.message).split('\n').filter(l => l.trim()).map(l => `<p style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6">${l}</p>`).join('')
  return `<!DOCTYPE html><html lang="es"><body style="margin:0;background:#f6f6f6;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
<div style="padding:20px 24px;background:#111;color:#fff;font-family:Helvetica,Arial,sans-serif"><b>Pedido ${esc(opts.number)}</b><div style="opacity:.7;font-size:12px">${esc(opts.supplier)}</div></div>
<div style="padding:20px 24px">${paragraphs}</div>
<table style="width:100%;border-collapse:collapse">${rows}</table>
<div style="padding:16px 24px;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#888">Enviado con Marginbite · ${esc(opts.appUrl)}</div></div></body></html>`
}

/** Crea el pedido, lo envía y lo marca enviado. Si el envío falla, el pedido queda en borrador y se dice. */
export async function sendOrder(ctx: Ctx, input: unknown, transports: { email?: EmailTransport; whatsapp?: WhatsAppTransport } = {}): Promise<{ order: Order; lines: OrderLine[]; sentTo: string }> {
  const d = sendOrderSchema.parse(input)
  const supplier = getSupplier(ctx, d.supplierId)
  const to = (d.to || (d.channel === 'email' ? supplier.email : supplier.phone) || '').trim()
  if (!to) throw new ValidationError(d.channel === 'email' ? 'El proveedor no tiene email: indícalo' : 'El proveedor no tiene teléfono: indícalo')
  if (d.channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new ValidationError('Email no válido')
  const phone = d.channel === 'whatsapp' ? normalizePhone(to) : null

  const order = createOrder(ctx, { supplierId: supplier.id, expectedDate: d.expectedDate, notes: d.notes, lines: d.items.map(i => ({ ingredientId: i.ingredientId ?? null, description: i.description, qty: i.qty, unit: i.unit ?? 'ud' })) })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://marginbite.com'
  try {
    if (d.channel === 'email') {
      const send = transports.email ?? gmailTransport
      await send({ to, subject: d.subject || `Pedido ${order.number}`, html: orderEmailHtml({ supplier: supplier.name, message: d.message, items: d.items, appUrl, number: order.number }), text: d.message })
    } else {
      const send = transports.whatsapp ?? evolutionTransport
      await send(phone!, d.message)
    }
  } catch (e: any) {
    // El pedido existe en borrador: se puede reintentar sin volver a teclearlo.
    throw new ValidationError(`No se pudo enviar el pedido ${order.number} (queda en borrador): ${e.message}`, { orderId: order.id })
  }
  const sent = setOrderStatus(ctx, order.id, 'sent', { sentVia: d.channel })
  return { order: sent, lines: order.lines, sentTo: d.channel === 'whatsapp' ? phone! : to }
}
