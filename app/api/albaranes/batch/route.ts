import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'
import { unitFactor } from '@/lib/foodcost'

export const dynamic = 'force-dynamic'

// Alta de albarán con líneas (entrada manual/integraciones). Mantiene la misma
// trazabilidad que el commit de Scanny: líneas vinculadas al documento, mapeo a
// ingrediente, precio anterior, % de cambio e historial con documento origen.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = user.id

  const body = await req.json()
  const { vendor, delivery_num, date_delivery, base, taxes, total, nif, received_by, lineas = [] } = body

  const albaran = db.prepare(
    `INSERT INTO albaranes_compra (user_id, vendor, delivery_num, date_delivery, base, taxes, total, nif, received_by, estado, source)
     VALUES (?,?,?,?,?,?,?,?,?,'validado','manual')`
  ).run(uid, vendor ?? null, delivery_num ?? null, date_delivery ?? null, base ?? null, taxes ?? null, total ?? null, nif ?? null, received_by ?? null)

  const albaranId = albaran.lastInsertRowid as number

  const priceChanges: { nombre: string; precio_anterior: number | null; precio_nuevo: number; diff_pct: number | null }[] = []

  const insertLinea = db.prepare(
    `INSERT INTO lineas_albaran_compra
       (user_id, albaran_id, doc_tipo, doc_id, vendor, nombre, cantidad, unidad, precio_unitario, total_linea, fecha,
        ingrediente_id, ingrediente_nombre, almacen_destino, precio_anterior, cambio_pct)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
  const insertHistorial = db.prepare(
    `INSERT INTO precio_historial (user_id, nombre, vendor, precio, unidad, fuente, ingrediente_id, precio_anterior, doc_tipo, doc_id)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  )

  const tx = db.transaction(() => {
    for (const l of lineas as any[]) {
      const { nombre, cantidad, unidad, precio_unitario, total_linea } = l
      if (!nombre) continue

      // Mapeo a ingrediente del catálogo (por id explícito o por nombre)
      const ing = l.ingrediente_id
        ? db.prepare(`SELECT id, descr, cost, unit, almacen_principal FROM ingredientes WHERE id=? AND user_id=?`).get(l.ingrediente_id, uid) as any
        : db.prepare(`SELECT id, descr, cost, unit, almacen_principal FROM ingredientes WHERE user_id=? AND descr LIKE ? LIMIT 1`).get(uid, '%' + nombre + '%') as any

      // Precio normalizado a la unidad base del ingrediente (g→kg, ml→l...)
      let nuevoCoste: number | null = null
      let cambioPct: number | null = null
      if (ing && precio_unitario != null) {
        const factor = unitFactor(unidad, ing.unit)
        nuevoCoste = factor !== 0 ? Math.round((Number(precio_unitario) / factor) * 10000) / 10000 : Number(precio_unitario)
        if (ing.cost > 0 && Math.abs(nuevoCoste - ing.cost) > 0.0001) {
          cambioPct = Math.round(((nuevoCoste - ing.cost) / ing.cost) * 1000) / 10
        }
      }

      insertLinea.run(
        uid, albaranId, 'albaran', albaranId, vendor ?? null, nombre, cantidad ?? null, unidad ?? null,
        precio_unitario ?? null, total_linea ?? null, date_delivery ?? new Date().toISOString().split('T')[0],
        ing?.id ?? null, ing?.descr ?? null, ing?.almacen_principal ?? null, ing?.cost ?? null, cambioPct,
      )

      if (ing && nuevoCoste != null) {
        db.prepare(`UPDATE ingredientes SET cost=? WHERE id=? AND user_id=?`).run(nuevoCoste, ing.id, uid)
        insertHistorial.run(uid, ing.descr ?? nombre, vendor ?? null, nuevoCoste, ing.unit ?? unidad ?? null, 'albaran', ing.id, ing.cost ?? null, 'albaran', albaranId)

        if (cambioPct !== null && Math.abs(cambioPct) >= 1) {
          priceChanges.push({ nombre: ing.descr ?? nombre, precio_anterior: ing.cost ?? null, precio_nuevo: nuevoCoste, diff_pct: cambioPct })
        }
      } else if (precio_unitario != null) {
        // Sin ingrediente en catálogo: registrar historial por nombre para no perder el dato
        insertHistorial.run(uid, nombre, vendor ?? null, precio_unitario, unidad ?? null, 'albaran', null, null, 'albaran', albaranId)
      }
    }
  })

  tx()

  return NextResponse.json({ albaran_id: albaranId, lineas_saved: lineas.length, price_changes: priceChanges })
}
