import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { parseRecetaHoja, norm, unidadesCompatibles, type Grid } from '@/lib/recetaImport'

export const dynamic = 'force-dynamic'

// Analiza las hojas de un Excel de recetario (ya convertidas a filas en el
// cliente con SheetJS) y devuelve las recetas detectadas con cada ingrediente
// cruzado contra el catálogo. NO guarda nada: eso lo hace /commit tras la revisión.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = user.id

  const { hojas } = await req.json() as { hojas: { nombre: string; filas: Grid }[] }
  if (!hojas?.length) return NextResponse.json({ error: 'El archivo no contiene hojas legibles' }, { status: 400 })

  // Catálogo en memoria para cruzar por nombre normalizado
  const catalogo = db.prepare(
    'SELECT id, descr, unit, cost, iva, almacen_principal, proveedor_id, proveedor_nombre FROM ingredientes WHERE user_id=?'
  ).all(uid) as any[]
  const porNombre = new Map<string, any>()
  for (const ing of catalogo) {
    const k = norm(ing.descr)
    if (k && !porNombre.has(k)) porNombre.set(k, ing)
  }

  const recetasExistentes = db.prepare('SELECT nombre, codigo FROM escandallo_receta WHERE user_id=?').all(uid) as any[]
  const nombresExistentes = new Set(recetasExistentes.map(r => norm(r.nombre)))
  const codigosExistentes = new Set(recetasExistentes.filter(r => r.codigo).map(r => norm(r.codigo)))

  /** Cruce de una línea del Excel con el catálogo: exacto → contenido → nuevo. */
  function emparejar(nombre: string) {
    const k = norm(nombre)
    if (!k) return null
    const exacto = porNombre.get(k)
    if (exacto) return { ing: exacto, tipo: 'exacto' as const }
    // Coincidencia parcial: "Pechuga de pollo" ↔ "Pollo pechuga fresca"
    for (const [clave, ing] of Array.from(porNombre.entries())) {
      if (clave.includes(k) || k.includes(clave)) return { ing, tipo: 'aproximado' as const }
    }
    return null
  }

  const recetas = hojas.map(h => {
    const parsed = parseRecetaHoja(h.nombre, h.filas || [])

    const lineas = parsed.lineas.map(l => {
      const m = emparejar(l.nombre)
      // La receta pide gramos y el catálogo lo vende por manojo/unidad: enlazarlo
      // daría un coste sin sentido. Se avisa y no se enlaza automáticamente.
      const compatible = m ? unidadesCompatibles(l.unidad, m.ing.unit) : true
      const enlazar = !!m && (compatible || m.tipo === 'exacto')

      return {
        ...l,
        accion: enlazar ? ('enlazar' as const) : ('crear' as const),
        ingrediente_id: enlazar ? m!.ing.id : null,
        ingrediente_nombre: enlazar ? m!.ing.descr : null,
        ingrediente_unidad: enlazar ? m!.ing.unit : null,
        coste_catalogo: m?.ing.cost ?? null,
        almacen_catalogo: m?.ing.almacen_principal ?? null,
        match: enlazar ? m!.tipo : null,
        unidades_incompatibles: !compatible,
        sugerencia: !compatible && m
          ? `«${m.ing.descr}» se controla en ${m.ing.unit || 'ud'} y la receta usa ${l.unidad}: no se enlaza automáticamente para no falsear el coste.`
          : null,
        // Coste efectivo: precio del Excel si viene; si no, el del catálogo
        // (solo cuando las unidades son comparables).
        coste_efectivo: l.precio ?? (enlazar ? m!.ing.cost : null) ?? null,
      }
    })

    const nombreNorm = norm(parsed.nombre || '')
    const duplicada = (nombreNorm && nombresExistentes.has(nombreNorm))
      || (parsed.codigo ? codigosExistentes.has(norm(parsed.codigo)) : false)

    const avisos = [...parsed.avisos]
    if (duplicada) avisos.push('Ya existe una receta con este nombre o código: al guardar se creará otra distinta.')

    return {
      ...parsed,
      lineas,
      duplicada,
      avisos,
      resumen: {
        total_lineas: lineas.length,
        a_enlazar: lineas.filter(l => l.accion === 'enlazar').length,
        a_crear: lineas.filter(l => l.accion === 'crear').length,
        sin_coste: lineas.filter(l => l.coste_efectivo == null).length,
        aproximados: lineas.filter(l => l.match === 'aproximado').length,
        unidades_incompatibles: lineas.filter(l => l.unidades_incompatibles).length,
      },
    }
  })

  return NextResponse.json({ recetas, catalogo_size: catalogo.length })
}
