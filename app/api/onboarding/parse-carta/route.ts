import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { images } = await req.json() as { images: string[] }
  if (!images || images.length === 0) return NextResponse.json({ error: 'Sin imágenes' }, { status: 400 })

  const content: any[] = [
    {
      type: 'text',
      text: `Extrae los platos de esta carta de restaurante. Para cada plato devuelve:
- nombre (string, exacto como aparece)
- categoria (string: "entrante", "principal", "postre", "bebida", "menu", etc.)
- precio_venta (number en euros, sin €. null si no se ve)
- descripcion (string corto si aparece, sino "")

Devuelve EXACTAMENTE un JSON con la forma: {"platos": [...]}
No incluyas variantes/medias raciones como platos separados — solo el principal.
No inventes nada que no se vea en la imagen.`,
    },
    ...images.map(img => ({ type: 'image_url', image_url: { url: img, detail: 'high' as const } })),
  ]

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content }],
    response_format: { type: 'json_object' },
    max_tokens: 3000,
    temperature: 0.1,
  })

  const raw = response.choices[0]?.message?.content || '{"platos":[]}'
  let parsed: any
  try { parsed = JSON.parse(raw) } catch { parsed = { platos: [] } }

  return NextResponse.json({ platos: parsed.platos || [] })
}
