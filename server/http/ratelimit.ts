// Límite de peticiones en memoria, ventana fija. Suficiente para una
// instancia; con varias habría que moverlo a Redis.
import { RateLimitedError } from '@/server/domain/errors'

const buckets = new Map<string, { n: number; reset: number }>()

export function rateLimit(key: string, limit: number, windowMs: number, message?: string): void {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now > b.reset) { buckets.set(key, { n: 1, reset: now + windowMs }); return }
  if (b.n >= limit) throw new RateLimitedError(message)
  b.n++
}

if (!(globalThis as any).__mbRlCleanup) {
  ;(globalThis as any).__mbRlCleanup = setInterval(() => {
    const now = Date.now()
    buckets.forEach((v, k) => { if (now > v.reset) buckets.delete(k) })
  }, 5 * 60_000)
  ;(globalThis as any).__mbRlCleanup.unref?.()
}
