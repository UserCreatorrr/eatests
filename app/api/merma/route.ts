import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { lineCost, unidadesCompatibles } from '@/lib/foodcost'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const uid = user?.id ?? ''

  const registros = db.prepare(`
    SELECT id, nombre, ingrediente_id, cantidad, unidad, motivo, coste_estimado, fecha, notas,
           site_id, servicio, almacen, tipo
    FROM merma_registro
    WHERE user_id = ?
    ORDER BY fecha DESC, id DESC
    LIMIT 100
  `).all(uid) as any[]

  // Stats este mes
  const statsMes = db.prepare(`
    SELECT
      COUNT(*) as total_eventos,
      ROUND(SUM(coste_estimado), 2) as coste_total,
      motivo,
      COUNT(*) as n
    FROM merma_registro
    WHERE user_id = ? AND strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now')
    GROUP BY motivo
    ORDER BY coste_total DESC
  `).all(uid) as any[]

  const totalMes = (db.prepare(`
    SELECT ROUND(SUM(coste_estimado), 2) as t, COUNT(*) as n
    FROM merma_registro
    WHERE user_id = ? AND strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now')
  `).get(uid) as any) ?? { t: 0, n: 0 }

  const totalAno = (db.prepare(`
    SELECT ROUND(SUM(coste_estimado), 2) as t
    FROM merma_registro
    WHERE user_id = ? AND strftime('%Y', fecha) = strftime('%Y', 'now')
  `).get(uid) as any) ?? { t: 0 }

  // Top productos con más merma
  const topProductos = db.prepare(`
    SELECT nombre, COUNT(*) as eventos, ROUND(SUM(coste_estimado), 2) as coste_total
    FROM merma_registro
    WHERE user_id = ? AND strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now')
    GROUP BY nombre
    ORDER BY coste_total DESC
    LIMIT 8
  `).all(uid)

  return NextResponse.json({ registros, statsMes, totalMes, totalAno, topProductos })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = user.id
  const body = await req.json()

  const { nombre, ingrediente_id, cantidad, unidad, motivo, coste_estimado, fecha, notas,
          site_id, servicio, almacen, tipo } = body
  if (!nombre || String(nombre).trim() === '') return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 })
  if (cantidad != null && (typeof cantidad !== 'number' ? isNaN(Number(cantidad)) : false)) {
    return NextResponse.json({ error: 'La cantidad debe ser un número' }, { status: 400 })
  }
  if (cantidad != null && Number(cantidad) < 0) {
    return NextResponse.json({ error: 'La cantidad de merma no puede ser negativa' }, { status: 400 })
  }
  if (coste_estimado != null && Number(coste_estimado) < 0) {
    return NextResponse.json({ error: 'El coste no puede ser negativo' }, { status: 400 })
  }

  // Ingrediente conectado (para coste automático y validación de unidad)
  const ing = ingrediente_id
    ? db.prepare('SELECT cost, unit FROM ingredientes WHERE id=? AND user_id=?').get(ingrediente_id, uid) as any
    : (tipo !== 'receta'
        ? db.prepare('SELECT cost, unit FROM ingredientes WHERE user_id=? AND descr LIKE ? LIMIT 1').get(uid, '%' + nombre + '%') as any
        : null)

  // La unidad de la merma debe ser de la misma magnitud que la del ingrediente
  if (ing && cantidad != null && !unidadesCompatibles(unidad, ing.unit)) {
    return NextResponse.json({ error: `La unidad "${unidad}" no es compatible con "${ing.unit}" del ingrediente.` }, { status: 400 })
  }

  // Coste automático: ingrediente (normalizando unidad) o, si es merma de receta,
  // el coste por ración del escandallo por el número de raciones mermadas.
  let coste = coste_estimado ?? null
  if (coste == null && cantidad != null) {
    if (ing?.cost) {
      coste = Math.round(lineCost(cantidad, unidad, ing.cost, ing.unit) * 100) / 100
    } else if (tipo === 'receta') {
      const rec = db.prepare('SELECT id, raciones FROM escandallo_receta WHERE user_id=? AND nombre LIKE ? AND activo=1 LIMIT 1').get(uid, '%' + nombre + '%') as any
      if (rec) {
        const cr = db.prepare(`
          SELECT SUM(COALESCE(l.cantidad,0) *
            COALESCE(CASE WHEN l.ingrediente_id IS NOT NULL AND i.cost IS NOT NULL THEN i.cost ELSE l.coste_unitario END,0) *
            CASE WHEN lower(COALESCE(l.unidad,'')) IN ('g','gr') AND lower(COALESCE(i.unit,''))='kg' THEN 0.001
                 WHEN lower(COALESCE(l.unidad,''))='ml' AND lower(COALESCE(i.unit,''))='l' THEN 0.001
                 WHEN lower(COALESCE(l.unidad,''))='cl' AND lower(COALESCE(i.unit,''))='l' THEN 0.01
                 ELSE 1 END) AS coste_total
          FROM escandallo_lineas l
          LEFT JOIN ingredientes i ON i.id = l.ingrediente_id AND i.user_id = l.user_id
          WHERE l.receta_id = ? AND l.user_id = ?
        `).get(rec.id, uid) as any
        const porRacion = (cr?.coste_total || 0) / (rec.raciones && rec.raciones > 0 ? rec.raciones : 1)
        coste = Math.round(porRacion * cantidad * 100) / 100
      }
    }
  }

  const r = db.prepare(`
    INSERT INTO merma_registro (user_id, nombre, ingrediente_id, cantidad, unidad, motivo, coste_estimado, fecha, notas, site_id, servicio, almacen, tipo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uid, nombre, ingrediente_id ?? null, cantidad ?? null, unidad ?? null, motivo ?? null,
         coste ?? null, fecha ?? new Date().toISOString().split('T')[0], notas ?? null,
         site_id ?? null, servicio ?? null, almacen ?? null, tipo ?? 'ingrediente')

  return NextResponse.json({ id: r.lastInsertRowid, coste_estimado: coste })
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const uid = user?.id ?? ''
  const { id } = await req.json()
  db.prepare('DELETE FROM merma_registro WHERE id = ? AND user_id = ?').run(id, uid)
  return NextResponse.json({ ok: true })
}
