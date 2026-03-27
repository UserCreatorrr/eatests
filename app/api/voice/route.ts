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
  return Response.json({ text: transcription.text })
}
