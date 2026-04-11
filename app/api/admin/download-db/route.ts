import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.INGEST_SECRET) {
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
