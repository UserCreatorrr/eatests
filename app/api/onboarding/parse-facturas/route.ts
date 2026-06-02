import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface LineaExtracted {
  nombre: string
  cantidad: number | null
  unidad: string | null
  precio_unitario: number | null
  total_linea: number | null
}

interface FacturaExtracted {
  vendor: string | null
  vendor_nif: string | null
  fecha: string | null
  total: number | null
  lineas: LineaExtracted[]
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { images } = await req.json() as { images: string[] }
  if (!images || images.length === 0) return NextResponse.json({ error: 'Sin imágenes' }, { status: 400 })

  // Procesar cada factura en paralelo
  const promises = images.map(async (img): Promise<FacturaExtracted> => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extrae los datos de esta factura/albarán de proveedor. Devuelve JSON:
{
  "vendor": "nombre del proveedor",
  "vendor_nif": "NIF si aparece, sino null",
  "fecha": "YYYY-MM-DD si se ve, sino null",
  "total": número o null,
  "lineas": [
    { "nombre": "producto", "cantidad": número, "unidad": "kg|l|ud|...", "precio_unitario": número, "total_linea": número }
  ]
}
Normaliza nombres a singular y sin marca (ej: "TOMATE PERA" → "Tomate pera").
No inventes nada que no se vea.`,
          },
          { type: 'image_url', image_url: { url: img, detail: 'high' } },
        ],
      }],
      response_format: { type: 'json_object' },
      max_tokens: 3000,
      temperature: 0.1,
    })
    try {
      return JSON.parse(response.choices[0]?.message?.content || '{}')
    } catch {
      return { vendor: null, vendor_nif: null, fecha: null, total: null, lineas: [] }
    }
  })

  const facturas = await Promise.all(promises)

  // Agregar ingredientes únicos por nombre normalizado, quedándose con el último precio visto
  const ingredientesMap: Record<string, { nombre: string; unidad: string | null; precio_unitario: number; vendor: string | null; fecha: string | null }> = {}
  for (const f of facturas) {
    for (const l of f.lineas || []) {
      if (!l.nombre || !l.precio_unitario || l.precio_unitario <= 0) continue
      const key = l.nombre.trim().toLowerCase()
      ingredientesMap[key] = {
        nombre: l.nombre.trim(),
        unidad: l.unidad,
        precio_unitario: l.precio_unitario,
        vendor: f.vendor,
        fecha: f.fecha,
      }
    }
  }

  const ingredientes = Object.values(ingredientesMap)
  const proveedores = Array.from(new Set(facturas.map(f => f.vendor).filter(Boolean) as string[]))
    .map(nombre => {
      const fmatch = facturas.find(f => f.vendor === nombre)
      return { nombre, nif: fmatch?.vendor_nif || null }
    })

  return NextResponse.json({ facturas, ingredientes, proveedores })
}
