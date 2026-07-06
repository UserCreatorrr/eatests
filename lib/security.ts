import { NextRequest } from 'next/server'
import db from './db'

// ─── Column whitelist (anti SQL-injection por identificador) ──────────────
// Las inserciones/updates dinámicos interpolan nombres de columna. Filtramos
// las claves contra las columnas REALES de la tabla (vía PRAGMA), de modo que
// cualquier clave maliciosa o inesperada (del cliente o del LLM) se descarta.
type ColInfo = { name: string; type: string; pk: number }
const colInfoCache: Record<string, ColInfo[]> = {}
const columnCache: Record<string, Set<string>> = {}

function colInfo(table: string): ColInfo[] {
  if (!colInfoCache[table]) {
    // `table` debe venir SIEMPRE de una whitelist del llamante, nunca del usuario.
    colInfoCache[table] = db.prepare(`PRAGMA table_info(${table})`).all() as ColInfo[]
  }
  return colInfoCache[table]
}

export function tableColumns(table: string): Set<string> {
  if (!columnCache[table]) {
    columnCache[table] = new Set(colInfo(table).map(r => r.name))
  }
  return columnCache[table]
}

/** true si la tabla tiene columna `id` de tipo TEXT (necesita UUID generado).
 *  false si es INTEGER PRIMARY KEY (autoincrement — no hay que fijar id). */
export function idIsText(table: string): boolean {
  const c = colInfo(table).find(x => x.name === 'id')
  return !!c && /TEXT|CHAR|CLOB/i.test(c.type)
}

/** Devuelve solo los campos cuya clave es una columna real de la tabla. */
export function pickValidColumns<T extends Record<string, unknown>>(
  table: string,
  fields: T,
): Partial<T> {
  const cols = tableColumns(table)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'user_id') continue // el user_id lo fija el servidor, nunca el input
    if (cols.has(k)) out[k] = v
  }
  return out as Partial<T>
}

// ─── Rate limiting (en memoria, ventana fija) ─────────────────────────────
// Suficiente para un MVP de una sola instancia. Si se escala a varias
// instancias, mover a Redis.
const buckets = new Map<string, { count: number; reset: number }>()

/** true = permitido, false = límite superado. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const e = buckets.get(key)
  if (!e || now > e.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    return true
  }
  if (e.count >= limit) return false
  e.count++
  return true
}

// Limpieza periódica para que el Map no crezca sin límite.
if (typeof globalThis !== 'undefined' && !(globalThis as any).__rlCleanup) {
  ;(globalThis as any).__rlCleanup = setInterval(() => {
    const now = Date.now()
    for (const [k, v] of Array.from(buckets)) if (now > v.reset) buckets.delete(k)
  }, 5 * 60 * 1000)
  // No bloquear el cierre del proceso por este timer.
  ;(globalThis as any).__rlCleanup?.unref?.()
}

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}
