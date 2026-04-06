import { NextRequest, NextResponse } from 'next/server'

// Migration status is no longer tracked in a DB table - migrations happen synchronously via n8n ingest
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ id: params.id, status: 'completed' })
}
