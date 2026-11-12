// Cifrado simétrico para secretos guardados en la BD (tokens OAuth).
// AES-256-GCM con clave derivada de APP_SECRET (o JWT_SECRET). Formato:
// v1:<iv b64>:<tag b64>:<ciphertext b64>
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function key(): Buffer {
  const s = process.env.APP_SECRET || process.env.JWT_SECRET
  if (!s || s === 'dev-secret-change-me-in-production') {
    if (process.env.NODE_ENV === 'production') throw new Error('APP_SECRET no configurado en producción')
    return createHash('sha256').update('dev-secret-change-me-in-production').digest()
  }
  return createHash('sha256').update(s).digest()
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${enc.toString('base64')}`
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(':')
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Formato cifrado no reconocido')
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'))
  d.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8')
}

export function isEncrypted(v: string): boolean {
  return v.startsWith('v1:')
}
