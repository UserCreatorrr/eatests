import { openai } from '@/lib/openai'
import { NextRequest } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/security'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!rateLimit(`voice:${user.id}`, 20, 60_000)) {
    return Response.json({ error: 'Demasiadas peticiones' }, { status: 429 })
  }
  const formData = await req.formData()
  const audio = formData.get('audio') as File
  if (!audio) return Response.json({ error: 'No audio' }, { status: 400 })

  const transcription = await openai.audio.transcriptions.create({
    file: audio,
    model: 'whisper-1',
    language: 'es',
  })
  const text = transcription.text
    .replace(/subtítulos realizados por la comunidad de amara\.org/gi, '')
    .replace(/subtitulos realizados por la comunidad de amara\.org/gi, '')
    .replace(/amara\.org/gi, '')
    .trim()
  return Response.json({ text })
}
