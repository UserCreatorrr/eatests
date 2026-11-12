// Envoltorio de ruta: autentica, valida la entrada con zod y convierte
// cualquier AppError al sobre { error: { code, message, details } }.
// Las rutas quedan en tres líneas y no tocan SQL.
import { NextRequest, NextResponse } from 'next/server'
import type { ZodSchema } from 'zod'
import { getDb } from '@/server/db/connection'
import { AppError, UnauthorizedError, ValidationError } from '@/server/domain/errors'
import { COOKIE_NAME, authenticate } from '@/server/services/auth'
import type { Ctx } from './context'

export interface RouteArgs<B, Q> {
  ctx: Ctx
  body: B
  query: Q
  params: Record<string, string>
  req: NextRequest
}

interface Options<B, Q> {
  body?: ZodSchema<B>
  query?: ZodSchema<Q>
  /** Permite llamar sin sesión (login, health). */
  public?: boolean
}

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof AppError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status })
  }
  const msg = String((e as any)?.message ?? e)
  // Las violaciones de la BD son errores de negocio, no 500: se traducen.
  if (/UNIQUE constraint failed/.test(msg)) {
    return NextResponse.json({ error: { code: 'CONFLICT', message: 'Ya existe un registro con esos datos', details: { constraint: msg.split('failed: ')[1] } } }, { status: 409 })
  }
  if (/FOREIGN KEY constraint failed/.test(msg)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Referencia a un registro que no existe o no es tuyo', details: {} } }, { status: 400 })
  }
  if (/CHECK constraint failed|DELIVERY_NOTE_|STOCK_LEDGER/.test(msg)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: traduceCheck(msg), details: { constraint: msg } } }, { status: 400 })
  }
  console.error('[unhandled]', e)
  return NextResponse.json({ error: { code: 'INTERNAL', message: 'Error interno', details: {} } }, { status: 500 })
}

function traduceCheck(msg: string): string {
  if (msg.includes('DELIVERY_NOTE_WITHOUT_LINES')) return 'El albarán no tiene líneas: añade al menos un producto antes de validarlo'
  if (msg.includes('DELIVERY_NOTE_LOCKED')) return 'El albarán está validado o facturado y no se puede modificar'
  if (msg.includes('STOCK_LEDGER')) return 'Los movimientos de stock no se editan: registra un ajuste'
  return 'Los datos no cumplen las reglas de la base de datos'
}

export function route<B = unknown, Q = unknown>(
  opts: Options<B, Q>,
  handler: (a: RouteArgs<B, Q>) => Promise<unknown> | unknown,
) {
  return async (req: NextRequest, context?: { params?: Record<string, string> }): Promise<NextResponse> => {
    try {
      const db = getDb()
      const ctx = await authenticate(db, req.cookies.get(COOKIE_NAME)?.value)
      if (!ctx && !opts.public) throw new UnauthorizedError()

      let body: B = undefined as B
      if (opts.body) {
        let raw: unknown
        try { raw = await req.json() } catch { throw new ValidationError('Petición no válida: el cuerpo no es JSON') }
        const r = opts.body.safeParse(raw)
        if (!r.success) {
          const first = r.error.issues[0]
          throw new ValidationError(first ? `${first.path.join('.') || 'campo'}: ${first.message}` : 'Datos no válidos', { issues: r.error.issues.slice(0, 5) })
        }
        body = r.data
      }
      let query: Q = undefined as Q
      if (opts.query) {
        const r = opts.query.safeParse(Object.fromEntries(req.nextUrl.searchParams))
        if (!r.success) throw new ValidationError('Parámetros no válidos', { issues: r.error.issues.slice(0, 5) })
        query = r.data
      }
      const out = await handler({ ctx: ctx as Ctx, body, query, params: context?.params ?? {}, req })
      if (out instanceof NextResponse) return out
      return NextResponse.json(out ?? { ok: true })
    } catch (e) {
      return errorResponse(e)
    }
  }
}

export const clientIp = (req: NextRequest) =>
  req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
