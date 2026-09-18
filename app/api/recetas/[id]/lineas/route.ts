import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'
import { unidadesCompatibles } from '@/lib/foodcost'
import { costeReceta, creariaCiclo, factorMerma } from '@/lib/escandallo'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const filas = db.prepare(`
    SELECT l.*,
           i.descr AS ing_nombre, i.cost AS ing_coste, i.unit AS ing_unidad,
           s.nombre AS sub_nombre, s.cantidad_producida AS sub_cantidad_producida,
           s.unidad_producida AS sub_unidad_producida
    FROM escandallo_lineas l
    LEFT JOIN ingredientes i ON l.ingrediente_id = i.id AND i.user_id = l.user_id
    LEFT JOIN escandallo_receta s ON l.subreceta_id = s.id AND s.user_id = l.user_id
    WHERE l.receta_id = ? AND l.user_id = ?
    ORDER BY l.id ASC
  `).all(params.id, user.id) as any[]

  // El coste de cada línea lo da el motor: es el único que sabe resolver una
  // subreceta (y aplicar la merma sin contarla dos veces).
  const coste = costeReceta(user.id, Number(params.id))
  const porLinea = new Map((coste?.lineas ?? []).map(l => [l.id, l]))

  const lineas = filas.map(f => {
    const c = porLinea.get(f.id)
    return {
      ...f,
      merma_pct: f.merma_pct ?? 0,
      cantidad_bruta: c?.cantidad_bruta ?? f.cantidad,
      coste_calculado: c?.coste ?? 0,
      coste_unitario_efectivo: c?.coste_unitario ?? 0,
      tipo: c?.tipo ?? (f.subreceta_id ? 'subreceta' : f.ingrediente_id ? 'ingrediente' : 'libre'),
      aviso: c?.aviso ?? null,
    }
  })

  return NextResponse.json({
    lineas,
    resumen: coste
      ? {
          coste_total: coste.coste_total,
          coste_racion: coste.coste_racion,
          food_cost_pct: coste.food_cost_pct,
          lineas_incompletas: coste.incompletas,
          ciclo: coste.ciclo,
        }
      : null,
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // La receta debe ser de quien llama: si no, no se cuelgan líneas de ella.
  const receta = db.prepare('SELECT id FROM escandallo_receta WHERE id = ? AND user_id = ?').get(params.id, user.id)
  if (!receta) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })

  const body = await req.json()
  const { ingrediente_id, subreceta_id, nombre_libre, cantidad, unidad } = body
  let { coste_unitario } = body

  const cant = Number(cantidad)
  if (!Number.isFinite(cant) || cant <= 0) {
    return NextResponse.json({ error: 'Cantidad requerida' }, { status: 400 })
  }

  // Merma: porcentaje de producto que se pierde limpiando o cocinando. La
  // cantidad tecleada es la NETA y el motor calcula lo que sale del almacén.
  const merma = body.merma_pct == null || body.merma_pct === '' ? 0 : Number(body.merma_pct)
  if (!Number.isFinite(merma) || merma < 0 || merma > 95) {
    return NextResponse.json({ error: 'La merma debe estar entre 0 y 95%.' }, { status: 400 })
  }

  if (ingrediente_id && subreceta_id) {
    return NextResponse.json({ error: 'Una línea es un ingrediente o una elaboración, no las dos cosas.' }, { status: 400 })
  }

  // ── Línea que es otra receta (elaboración intermedia) ─────────────────
  if (subreceta_id) {
    const sub = db.prepare(
      'SELECT id, nombre, cantidad_producida, unidad_producida FROM escandallo_receta WHERE id = ? AND user_id = ?'
    ).get(subreceta_id, user.id) as any
    if (!sub) return NextResponse.json({ error: 'Elaboración no encontrada' }, { status: 404 })

    // Sin esto, A dentro de B dentro de A cuelga el cálculo de coste.
    if (creariaCiclo(user.id, Number(params.id), Number(subreceta_id))) {
      return NextResponse.json({ error: `No puedes usar "${sub.nombre}" aquí: se crearía una referencia circular (esa elaboración ya depende de esta receta).` }, { status: 400 })
    }

    const unidadSub = sub.cantidad_producida > 0 ? sub.unidad_producida : 'ud'
    if (!unidadesCompatibles(unidad, unidadSub)) {
      return NextResponse.json({ error: `La unidad "${unidad}" no es compatible con "${unidadSub}", que es como se produce "${sub.nombre}".` }, { status: 400 })
    }
    if (!(sub.cantidad_producida > 0)) {
      return NextResponse.json({ error: `Antes de usar "${sub.nombre}" como elaboración, indica cuánto produce la receta (por ejemplo 2000 g).` }, { status: 400 })
    }

    const result = db.prepare(`
      INSERT INTO escandallo_lineas (receta_id, user_id, subreceta_id, nombre_libre, cantidad, unidad, merma_pct)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(params.id, user.id, subreceta_id, sub.nombre, cant, unidad ?? null, merma)
    return NextResponse.json({ id: result.lastInsertRowid })
  }

  if (ingrediente_id) {
    // El ingrediente debe ser del mismo usuario (no se referencia el de otro cliente)
    const ing = db.prepare('SELECT cost, unit FROM ingredientes WHERE id = ? AND user_id = ?').get(ingrediente_id, user.id) as any
    if (!ing) return NextResponse.json({ error: 'Ingrediente no encontrado' }, { status: 404 })
    // Unidad de la misma magnitud que la del ingrediente (14 ud de algo en kg no vale)
    if (!unidadesCompatibles(unidad, ing.unit)) {
      return NextResponse.json({ error: `La unidad "${unidad}" no es compatible con "${ing.unit}" del ingrediente. Usa una unidad de la misma magnitud.` }, { status: 400 })
    }
    if (coste_unitario == null && ing.cost) coste_unitario = ing.cost
  }

  const result = db.prepare(`
    INSERT INTO escandallo_lineas (receta_id, user_id, ingrediente_id, nombre_libre, cantidad, unidad, coste_unitario, merma_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(params.id, user.id, ingrediente_id ?? null, nombre_libre ?? null, cant, unidad ?? null, coste_unitario ?? null, merma)

  return NextResponse.json({ id: result.lastInsertRowid, cantidad_bruta: Math.round(cant * factorMerma(merma) * 10000) / 10000 })
}
