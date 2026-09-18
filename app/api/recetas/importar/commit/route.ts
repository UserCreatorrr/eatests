import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { unidadBaseCompra } from '@/lib/recetaImport'

export const dynamic = 'force-dynamic'

/**
 * Cantidad y merma que se guardan en la línea.
 * El motor de coste parte SIEMPRE de la cantidad neta y le aplica la merma para
 * recuperar la bruta (1900 g / (1 - 0,05) = 2000 g). Por eso:
 *   · con neta y merma → se guardan las dos y el coste sale sobre la bruta.
 *   · con bruta pero sin neta → se guarda la bruta y la merma se anota a 0, o
 *     el coste la inflaría una segunda vez sobre una cantidad que ya la incluye.
 */
function cantidadYMerma(l: LineaRevisada): { cantidad: number; merma: number | null } {
  const merma = l.merma_pct && l.merma_pct > 0 ? l.merma_pct : null
  if (merma && l.cantidad_neta && l.cantidad_neta > 0) return { cantidad: l.cantidad_neta, merma }
  return { cantidad: l.cantidad_bruta ?? l.cantidad_neta ?? 0, merma: null }
}

interface LineaRevisada {
  nombre: string
  unidad: string | null
  cantidad_bruta: number | null
  cantidad_neta: number | null
  merma_pct: number | null
  nota: string | null
  proveedor: string | null
  accion: 'enlazar' | 'crear' | 'omitir'
  ingrediente_id: number | null
  coste_efectivo: number | null
}

interface RecetaRevisada {
  nombre: string | null
  codigo: string | null
  familia: string | null
  raciones: number | null
  rendimiento_neto: number | null
  gramos_porcion: number | null
  precio_venta: number | null
  descripcion: string | null
  alergenos: string | null
  conservacion: string | null
  regeneracion: string | null
  observaciones: string | null
  procedimiento: any[]
  lineas: LineaRevisada[]
}

// Guarda las recetas revisadas: crea los ingredientes nuevos en el catálogo,
// da de alta el escandallo con su ficha técnica y sus líneas estructuradas.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = user.id

  const { recetas } = await req.json() as { recetas: RecetaRevisada[] }
  if (!recetas?.length) return NextResponse.json({ error: 'Nada que importar' }, { status: 400 })

  const resultado = { recetas_creadas: 0, lineas: 0, ingredientes_creados: 0, detalles: [] as any[] }

  const tx = db.transaction(() => {
    for (const r of recetas) {
      const nombre = (r.nombre || '').trim()
      if (!nombre) continue

      const infoReceta = db.prepare(`
        INSERT INTO escandallo_receta
          (user_id, nombre, categoria, descripcion, raciones, precio_venta, notas, activo,
           codigo, rendimiento_neto, gramos_porcion, alergenos, procedimiento, conservacion, regeneracion, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 'excel')
      `).run(
        uid, nombre, r.familia || null, r.descripcion || null,
        r.raciones ?? null, r.precio_venta ?? null, r.observaciones || null,
        r.codigo || null, r.rendimiento_neto ?? null, r.gramos_porcion ?? null,
        r.alergenos || null,
        r.procedimiento?.length ? JSON.stringify(r.procedimiento) : null,
        r.conservacion || null, r.regeneracion || null,
      )
      const recetaId = infoReceta.lastInsertRowid as number
      resultado.recetas_creadas++
      let lineasReceta = 0
      let creadosReceta = 0

      for (const l of r.lineas || []) {
        if (l.accion === 'omitir') continue
        const nombreLinea = (l.nombre || '').trim()
        if (!nombreLinea) continue

        let ingredienteId = l.ingrediente_id ?? null

        // Alta en catálogo de los ingredientes que no existían
        if (l.accion === 'crear' && !ingredienteId) {
          // Evita duplicar si el mismo ingrediente aparece en varias recetas del lote
          const ya = db.prepare('SELECT id FROM ingredientes WHERE user_id=? AND lower(descr)=lower(?) LIMIT 1')
            .get(uid, nombreLinea) as any
          if (ya) {
            ingredienteId = ya.id
          } else {
            // La ficha da cantidades en g/ml pero precios en €/kg·L·ud: el
            // ingrediente nace con la unidad de COMPRA, o el coste saldría x1000.
            const info = db.prepare(`
              INSERT INTO ingredientes (user_id, descr, type, unit, cost, proveedor_nombre)
              VALUES (?, ?, 'Ingrediente', ?, ?, ?)
            `).run(uid, nombreLinea, unidadBaseCompra(l.unidad), l.coste_efectivo ?? null, l.proveedor || null)
            ingredienteId = info.lastInsertRowid as number
            creadosReceta++
            resultado.ingredientes_creados++
          }
        }

        const { cantidad, merma } = cantidadYMerma(l)
        db.prepare(`
          INSERT INTO escandallo_lineas
            (receta_id, user_id, ingrediente_id, nombre_libre, cantidad, unidad, coste_unitario, merma_pct, cantidad_neta, nota)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          recetaId, uid,
          ingredienteId,
          ingredienteId ? null : nombreLinea,     // sin ingrediente → queda como línea libre
          cantidad,
          l.unidad || null,
          l.coste_efectivo ?? null,
          merma,
          l.cantidad_neta ?? null,
          l.nota || null,
        )
        lineasReceta++
        resultado.lineas++
      }

      resultado.detalles.push({ id: recetaId, nombre, lineas: lineasReceta, ingredientes_creados: creadosReceta })
    }
  })

  try { tx() } catch (e: any) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, resultado })
}
