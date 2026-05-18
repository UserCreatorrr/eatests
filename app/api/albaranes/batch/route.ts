import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = user.id

  const body = await req.json()
  const { vendor, delivery_num, date_delivery, base, taxes, total, nif, received_by, lineas = [] } = body

  const albaran = db.prepare(
    `INSERT INTO albaranes_compra (user_id, vendor, delivery_num, date_delivery, base, taxes, total, nif, received_by)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(uid, vendor ?? null, delivery_num ?? null, date_delivery ?? null, base ?? null, taxes ?? null, total ?? null, nif ?? null, received_by ?? null)

  const albaranId = albaran.lastInsertRowid

  const priceChanges: { nombre: string; precio_anterior: number | null; precio_nuevo: number; diff_pct: number | null }[] = []

  const insertLinea = db.prepare(
    `INSERT INTO lineas_albaran_compra (user_id, vendor, nombre, cantidad, unidad, precio_unitario, total_linea, fecha)
     VALUES (?,?,?,?,?,?,?,?)`
  )
  const insertHistorial = db.prepare(
    `INSERT INTO precio_historial (user_id, nombre, vendor, precio, unidad, fuente) VALUES (?,?,?,?,?,?)`
  )

  const tx = db.transaction(() => {
    for (const l of lineas as any[]) {
      const { nombre, cantidad, unidad, precio_unitario, total_linea } = l
      if (!nombre) continue

      insertLinea.run(uid, vendor ?? null, nombre, cantidad ?? null, unidad ?? null, precio_unitario ?? null, total_linea ?? null, date_delivery ?? new Date().toISOString().split('T')[0])

      if (precio_unitario != null) {
        // Get previous price for delta
        const prev = db.prepare(
          `SELECT precio FROM precio_historial WHERE user_id=? AND nombre LIKE ? ORDER BY id DESC LIMIT 1`
        ).get(uid, '%' + nombre + '%') as any

        insertHistorial.run(uid, nombre, vendor ?? null, precio_unitario, unidad ?? null, 'albaran')

        // Update ingredient cost
        const ing = db.prepare(
          `SELECT id FROM ingredientes WHERE user_id=? AND descr LIKE ? LIMIT 1`
        ).get(uid, '%' + nombre + '%') as any
        if (ing) db.prepare(`UPDATE ingredientes SET cost=? WHERE id=? AND user_id=?`).run(precio_unitario, ing.id, uid)

        const prevPrice = prev?.precio ?? null
        const diffPct = prevPrice && prevPrice > 0
          ? Math.round(((precio_unitario - prevPrice) / prevPrice) * 100)
          : null

        if (diffPct !== null && Math.abs(diffPct) >= 1) {
          priceChanges.push({ nombre, precio_anterior: prevPrice, precio_nuevo: precio_unitario, diff_pct: diffPct })
        }
      }
    }
  })

  tx()

  return NextResponse.json({ albaran_id: albaranId, lineas_saved: lineas.length, price_changes: priceChanges })
}
