import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  // Volcado COMPLETO de la DB (multi-tenant). Deshabilitado salvo que
  // INGEST_SECRET esté configurado; preferir cabecera a query (no se registra).
  const expected = process.env.INGEST_SECRET
  const secret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.nextUrl.searchParams.get('secret')
  if (!expected || secret !== expected) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const dbPath = process.env.DB_PATH || '/data/marginbites.db'
  const resolved = path.resolve(dbPath)

  if (!fs.existsSync(resolved)) {
    return new NextResponse('DB not found', { status: 404 })
  }

  const buffer = fs.readFileSync(resolved)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="marginbites.db"',
      'Content-Length': buffer.length.toString(),
    },
  })
}
