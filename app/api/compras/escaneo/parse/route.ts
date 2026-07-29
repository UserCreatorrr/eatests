import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { unitFactor } from '@/lib/foodcost'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

// Escanea un albarán/factura → cabecera + líneas, mapea cada línea a un
// ingrediente del catálogo y detecta cambios de precio. NO guarda nada todavía
// (eso lo hace /commit tras la validación del usuario).
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = user.id

  const { image, tipo } = await req.json() as { image: string; tipo: 'albaran' | 'factura' }
  if (!image) return NextResponse.json({ error: 'Sin imagen' }, { status: 400 })

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Extrae los datos de este ${tipo === 'factura' ? 'factura' : 'albarán'} de proveedor. Devuelve JSON:
{
  "vendor": "nombre del proveedor",
  "vendor_nif": "NIF/CIF si aparece, sino null",
  "doc_num": "número de documento si aparece, sino null",
  "fecha": "YYYY-MM-DD si se ve, sino null",
  "fecha_vencimiento": "YYYY-MM-DD si es factura y se ve, sino null",
  "base": número o null,
  "iva": número (importe IVA total del documento) o null,
  "total": número o null,
  "lineas": [
    { "nombre": "producto", "cantidad": número, "unidad": "kg|l|ud|...", "precio_unitario": número, "total_linea": número, "iva_pct": número (0|4|10|21) si el % de IVA de esa línea aparece, sino null }
  ]
}
Normaliza nombres a singular sin marca. Para iva_pct usa el porcentaje (no el importe). No inventes nada que no se vea.`,
        },
        { type: 'image_url', image_url: { url: image, detail: 'high' } },
      ],
    }],
    response_format: { type: 'json_object' },
    max_tokens: 3000,
    temperature: 0.1,
  })

  let doc: any
  try { doc = JSON.parse(res.choices[0]?.message?.content || '{}') } catch { doc = {} }

  // Proveedor: buscar match en catálogo
  const provMatch = doc.vendor
    ? db.prepare('SELECT id, descr FROM proveedores WHERE user_id=? AND descr LIKE ? LIMIT 1').get(uid, `%${doc.vendor}%`) as any
    : null

  // Mapear cada línea a un ingrediente + detectar cambio de precio
  const lineas = (doc.lineas || []).map((l: any) => {
    const nombre = (l.nombre || '').trim()
    const ing = nombre
      ? db.prepare('SELECT id, descr, unit, cost, iva FROM ingredientes WHERE user_id=? AND descr LIKE ? LIMIT 1').get(uid, `%${nombre}%`) as any
      : null
    const precioNuevo = l.precio_unitario != null ? Number(l.precio_unitario) : null
    let cambio_pct: number | null = null
    if (ing && ing.cost && precioNuevo != null) {
      // Comparar normalizando: precio del doc está en l.unidad; el coste en ing.unit
      const factor = unitFactor(l.unidad, ing.unit)   // doc-unit → ing-unit
      const precioEnUnidadIng = factor !== 0 ? precioNuevo / factor : precioNuevo
      if (ing.cost > 0 && Math.abs(precioEnUnidadIng - ing.cost) > 0.0001) {
        cambio_pct = Math.round(((precioEnUnidadIng - ing.cost) / ing.cost) * 100)
      }
    }
    // IVA de la línea: el detectado por OCR, o el del ingrediente mapeado como propuesta
    const ivaLinea = l.iva_pct != null ? Number(l.iva_pct) : (ing?.iva ?? null)
    return {
      nombre,
      cantidad: l.cantidad != null ? Number(l.cantidad) : null,
      unidad: l.unidad || null,
      precio_unitario: precioNuevo,
      total_linea: l.total_linea != null ? Number(l.total_linea) : null,
      iva_pct: ivaLinea,
      ingrediente_id: ing?.id ?? null,
      ingrediente_nombre: ing?.descr ?? null,
      ingrediente_unidad: ing?.unit ?? null,
      coste_actual: ing?.cost ?? null,
      cambio_pct,
      mapeado: !!ing,
    }
  })

  const sinMapear = lineas.filter((l: any) => !l.mapeado).length
  const conCambio = lineas.filter((l: any) => l.cambio_pct != null).length
  const sinIva = lineas.filter((l: any) => l.iva_pct == null).length

  // Cuadre del documento (FC-07): base + IVA debe aproximar el total.
  const sumaLineas = lineas.reduce((s: number, l: any) => s + (l.total_linea ?? 0), 0)
  const baseNum = doc.base != null ? Number(doc.base) : null
  const ivaNum = doc.iva != null ? Number(doc.iva) : null
  const totalNum = doc.total != null ? Number(doc.total) : null
  const descuadre = (baseNum != null && ivaNum != null && totalNum != null)
    ? Math.round((baseNum + ivaNum - totalNum) * 100) / 100
    : null

  return NextResponse.json({
    cabecera: {
      vendor: doc.vendor ?? null,
      vendor_nif: doc.vendor_nif ?? null,
      proveedor_id: provMatch?.id ?? null,
      proveedor_match: provMatch?.descr ?? null,
      doc_num: doc.doc_num ?? null,
      fecha: doc.fecha ?? null,
      fecha_vencimiento: doc.fecha_vencimiento ?? null,
      base: doc.base ?? null,
      iva: doc.iva ?? null,
      total: doc.total ?? null,
    },
    lineas,
    cuadre: {
      suma_lineas: Math.round(sumaLineas * 100) / 100,
      base: baseNum,
      iva: ivaNum,
      total: totalNum,
      descuadre,            // base+iva-total; null si falta algún dato
    },
    warnings: {
      sin_mapear: sinMapear,
      con_cambio_precio: conCambio,
      proveedor_nuevo: !provMatch,
      sin_iva: sinIva,
      descuadre: descuadre != null && Math.abs(descuadre) > 0.02,
    },
    tipo,
  })
}
