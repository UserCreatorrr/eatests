import { openai } from '@/lib/openai'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
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
