import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/gmail'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { to, subject, body } = await req.json()
  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Faltan campos: to, subject, body' }, { status: 400 })
  }

  try {
    await sendEmail(to, subject, body)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
