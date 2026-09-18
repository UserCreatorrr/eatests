import { NextRequest } from 'next/server'
import db from './db'
import { unidadCanonica } from './foodcost'

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
    // user_id e id NUNCA vienen del input: el user_id lo fija el servidor y el id
    // lo pone la BD. Dejar pasar `id` permitía, con INSERT OR REPLACE, que un
    // cliente pisara/robara el registro de otro enviando su id (multi-tenant).
    if (k === 'user_id' || k === 'id') continue
    if (cols.has(k)) out[k] = v
  }
  return out as Partial<T>
}

// ─── Validación de tipos y rangos ─────────────────────────────────────────
// SQLite tiene tipado dinámico: acepta la cadena "no-soy-numero" en una columna
// REAL y luego la trata como 0 al calcular, corrompiendo el food cost en
// silencio. Estas comprobaciones se hacen en el servidor porque la validación
// del formulario se puede saltar llamando directamente a la API.

const COLUMNAS_NO_NEGATIVAS = new Set([
  'cost', 'coste', 'coste_unitario', 'coste_hora', 'coste_empresa', 'coste_estimado',
  'precio', 'precio_venta', 'precio_unitario', 'precio_anterior',
  'cantidad', 'cantidad_neta', 'raciones', 'total', 'total_linea', 'base', 'taxes',
  'iva', 'iva_pct', 'merma_pct', 'sales_net', 'covers', 'orders', 'tickets',
  'rendimiento_neto', 'gramos_porcion', 'contract_hours_week', 'horas_plan', 'horas_real',
  'cantidad_producida',
])

// Techo de cordura: por encima de esto es un error de tecleo, no un dato real.
const MAXIMO_RAZONABLE = 1e9

export class ValidationError extends Error {}

// Tablas cuya columna `unit`/`unidad` debe pertenecer al vocabulario cerrado.
const UNIDAD_COL: Record<string, string> = {
  ingredientes: 'unit',
  herramientas: 'unit',
  // Unidad en la que una elaboración declara su producción (2000 "g" de salsa).
  escandallo_receta: 'unidad_producida',
}

/** Convierte y valida los campos numéricos según el tipo real de cada columna. */
export function coerceAndValidate<T extends Record<string, unknown>>(
  table: string,
  fields: T,
): T {
  const info = colInfo(table)
  const out: Record<string, unknown> = { ...fields }

  // Unidad base contra el vocabulario cerrado (causa raíz P0-2: era texto libre).
  const ucol = UNIDAD_COL[table]
  if (ucol && out[ucol] != null && out[ucol] !== '') {
    const canon = unidadCanonica(String(out[ucol]))
    if (!canon) throw new ValidationError(`La unidad "${String(out[ucol]).slice(0, 20)}" no es válida. Usa kg, g, l, ml, cl, ud o docena.`)
    out[ucol] = canon
  }

  for (const col of info) {
    if (!(col.name in out)) continue
    const v = out[col.name]
    if (v === null || v === undefined || v === '') { out[col.name] = null; continue }

    const esNumerica = /INT|REAL|NUM|DEC|DOUB|FLOA/i.test(col.type)
    if (!esNumerica) {
      // Tope de longitud en texto: evita nombres de miles de caracteres que
      // rompen tablas y desplegables. Las columnas de contenido largo se excluyen.
      if (typeof v === 'string' && v.length > 600 && !/image|payload|procedimiento|notas|descr_larga|body|html/i.test(col.name)) {
        throw new ValidationError(`El campo "${col.name}" es demasiado largo (máximo 600 caracteres).`)
      }
      continue
    }

    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').trim())
    if (!Number.isFinite(n)) {
      throw new ValidationError(`El campo "${col.name}" debe ser un número (se recibió "${String(v).slice(0, 40)}").`)
    }
    if (COLUMNAS_NO_NEGATIVAS.has(col.name) && n < 0) {
      throw new ValidationError(`El campo "${col.name}" no puede ser negativo (se recibió ${n}).`)
    }
    if (Math.abs(n) > MAXIMO_RAZONABLE) {
      throw new ValidationError(`El valor de "${col.name}" (${n}) está fuera de rango. Revisa si te has equivocado al teclear.`)
    }
    out[col.name] = n
  }
  return out as T
}

/** Campos de texto que no pueden quedar vacíos al crear la entidad. */
const NOMBRE_OBLIGATORIO: Record<string, { campo: string; etiqueta: string }> = {
  ingredientes: { campo: 'descr', etiqueta: 'nombre del ingrediente' },
  proveedores: { campo: 'descr', etiqueta: 'nombre del proveedor' },
  escandallo_receta: { campo: 'nombre', etiqueta: 'nombre de la receta' },
  empleados: { campo: 'nombre', etiqueta: 'nombre del empleado' },
}

/** Evita crear registros sin nombre, que luego aparecen en blanco en las listas. */
export function requireNombre(table: string, fields: Record<string, unknown>) {
  const req = NOMBRE_OBLIGATORIO[table]
  if (!req) return
  const v = fields[req.campo]
  if (v === undefined) return                  // actualización parcial: no aplica
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ValidationError(`Falta el ${req.etiqueta}.`)
  }
}

/**
 * Un ingrediente con proveedor tiene que tener precio (spec 13-sep, Fase 2).
 * Si se sabe a quién se le compra, se sabe a cuánto; y sin precio la línea de
 * escandallo cuenta 0 y el food cost sale por debajo del real sin que nadie
 * lo note. `actual` es la fila que ya está en BD, para que una edición parcial
 * se valide sobre el resultado final y no solo sobre lo que llega en el body.
 */
export function requirePrecioConProveedor(
  table: string,
  fields: Record<string, unknown>,
  actual?: { proveedor_id?: unknown; proveedor_nombre?: unknown; cost?: unknown } | null,
) {
  if (table !== 'ingredientes') return
  const final = (k: string) => (k in fields ? fields[k] : (actual as any)?.[k])
  const tieneProveedor = !!final('proveedor_id') || String(final('proveedor_nombre') ?? '').trim() !== ''
  if (!tieneProveedor) return
  const precio = Number(final('cost') ?? 0)
  if (!(precio > 0)) {
    throw new ValidationError('Si el ingrediente tiene proveedor, necesita un precio de compra. Sin precio, las recetas que lo lleven darían un food cost más bajo del real.')
  }
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
