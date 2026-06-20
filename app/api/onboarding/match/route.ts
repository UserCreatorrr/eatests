import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { getUserFromRequest } from '@/lib/auth'
import { lineCost } from '@/lib/foodcost'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface Plato {
  nombre: string
  categoria?: string
  precio_venta: number | null
  descripcion?: string
}

interface IngredienteExt {
  nombre: string
  unidad: string | null
  precio_unitario: number
  vendor?: string | null
}

interface EscandalloProposal {
  plato: string
  precio_venta: number | null
  raciones_estimadas: number
  lineas: {
    ingrediente: string
    cantidad: number
    unidad: string
    precio_unitario: number
    coste: number
    confianza: 'alta' | 'media' | 'baja'
  }[]
  coste_total: number
  food_cost_pct: number | null
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { platos, ingredientes } = await req.json() as { platos: Plato[]; ingredientes: IngredienteExt[] }
  if (!platos?.length || !ingredientes?.length) {
    return NextResponse.json({ error: 'Faltan platos o ingredientes' }, { status: 400 })
  }

  const catalogoStr = ingredientes
    .map((i, idx) => `${idx + 1}. ${i.nombre} — ${i.precio_unitario}€/${i.unidad || 'ud'}`)
    .join('\n')

  // Procesar en lotes para no saturar tokens. Hasta 8 platos por llamada.
  const lotes: Plato[][] = []
  for (let i = 0; i < platos.length; i += 8) lotes.push(platos.slice(i, i + 8))

  const propuestas: EscandalloProposal[] = []

  for (const lote of lotes) {
    const platosStr = lote
      .map(p => `- ${p.nombre}${p.precio_venta ? ` (PVP ${p.precio_venta}€)` : ''}${p.descripcion ? ` — ${p.descripcion}` : ''}`)
      .join('\n')

    const prompt = `Eres un chef profesional que escandalla recetas. Para cada plato, deduce qué ingredientes del CATÁLOGO se usan razonablemente y con qué cantidad por ración estándar.

CATÁLOGO DE INGREDIENTES (con precio por unidad):
${catalogoStr}

PLATOS:
${platosStr}

Para cada plato devuelve, por ingrediente:
- "cantidad": número por 1 ración
- "unidad": la unidad en la que expresas la cantidad. USA SIEMPRE unidades operativas de cocina:
    · sólidos → "g" (gramos)   ej: 180 g de carne, 40 g de aceite, 5 g de sal
    · líquidos → "ml" (mililitros)   ej: 50 ml de nata, 20 ml de vino
    · piezas → "ud" (unidades)   ej: 1 ud de huevo, 2 ud de vieira
- "confianza": "alta" si el ingrediente claramente forma parte del plato, "media" si es probable, "baja" si es solo posible
Y por plato: "raciones_estimadas" (cuántas raciones rinde la receta base, típicamente 1)

Reglas:
- Solo usa ingredientes del catálogo. NO inventes.
- Cantidades realistas en cocina profesional. NUNCA pongas cantidades absurdas (ej: 180 kg de carne).
- Si un plato no tiene ingredientes claros en el catálogo, devuelve "lineas": []

Devuelve JSON: {"propuestas": [{"plato": "...", "lineas": [{"ingrediente": "nombre exacto del catálogo", "cantidad": número, "unidad": "g"|"ml"|"ud", "confianza": "alta"|"media"|"baja"}]}]}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0.2,
    })

    let parsed: any = { propuestas: [] }
    try { parsed = JSON.parse(response.choices[0]?.message?.content || '{}') } catch {}

    for (const p of (parsed.propuestas || []) as any[]) {
      const original = lote.find(pl => pl.nombre === p.plato)
      if (!original) continue
      const lineas = (p.lineas || []).map((l: any) => {
        const ing = ingredientes.find(i => i.nombre.toLowerCase() === (l.ingrediente || '').toLowerCase())
        if (!ing) return null
        const cantidad = Number(l.cantidad) || 0
        const unidadLinea = (l.unidad || ing.unidad || 'ud') as string
        // Coste real normalizando la unidad de la línea (g/ml) contra la del coste (kg/l)
        const coste = lineCost(cantidad, unidadLinea, ing.precio_unitario, ing.unidad)
        return {
          ingrediente: ing.nombre,
          cantidad,
          unidad: unidadLinea,
          precio_unitario: ing.precio_unitario,
          coste: Math.round(coste * 10000) / 10000,
          confianza: (l.confianza || 'media') as 'alta' | 'media' | 'baja',
        }
      }).filter(Boolean)
      const costeTotal = lineas.reduce((s: number, l: any) => s + l.coste, 0)
      propuestas.push({
        plato: p.plato,
        precio_venta: original.precio_venta,
        raciones_estimadas: Number(p.raciones_estimadas) || 1,
        lineas,
        coste_total: Math.round(costeTotal * 100) / 100,
        food_cost_pct: original.precio_venta && original.precio_venta > 0
          ? Math.round((costeTotal / original.precio_venta) * 100)
          : null,
      })
    }
  }

  return NextResponse.json({ propuestas })
}
