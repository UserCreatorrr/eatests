import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const uid = user?.id ?? ''

  const registros = db.prepare(`
    SELECT id, nombre, ingrediente_id, cantidad, unidad, motivo, coste_estimado, fecha, notas
    FROM merma_registro
    WHERE user_id = ?
    ORDER BY fecha DESC
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
  const uid = user?.id ?? ''
  const body = await req.json()

  const { nombre, ingrediente_id, cantidad, unidad, motivo, coste_estimado, fecha, notas } = body
  if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })

  const r = db.prepare(`
    INSERT INTO merma_registro (user_id, nombre, ingrediente_id, cantidad, unidad, motivo, coste_estimado, fecha, notas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uid, nombre, ingrediente_id ?? null, cantidad ?? null, unidad ?? null, motivo ?? null, coste_estimado ?? null, fecha ?? new Date().toISOString().split('T')[0], notas ?? null)

  return NextResponse.json({ id: r.lastInsertRowid })
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const uid = user?.id ?? ''
  const { id } = await req.json()
  db.prepare('DELETE FROM merma_registro WHERE id = ? AND user_id = ?').run(id, uid)
  return NextResponse.json({ ok: true })
}
