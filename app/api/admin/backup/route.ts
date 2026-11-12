import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/server/db/connection'

export const dynamic = 'force-dynamic'

// Copia consistente de la BD (SQLite backup API, no cp del fichero con WAL
// abierto). Solo con ADMIN_SECRET y por cabecera, nunca por query string.
export async function GET(req: NextRequest) {
  const expected = process.env.ADMIN_SECRET
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!expected || !given || given !== expected) return new NextResponse('Forbidden', { status: 403 })
  const os = await import('node:os'), path = await import('node:path'), fs = await import('node:fs/promises')
  const tmp = path.join(os.tmpdir(), `marginbite-backup-${Date.now()}.db`)
  await getDb().backup(tmp)
  const buffer = await fs.readFile(tmp)
  await fs.unlink(tmp).catch(() => {})
  return new NextResponse(buffer, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="marginbite-${new Date().toISOString().slice(0, 10)}.db"`, 'Content-Length': String(buffer.length) } })
}
