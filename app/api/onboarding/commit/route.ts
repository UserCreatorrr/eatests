import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface CommitPayload {
  proveedores: { nombre: string; nif: string | null }[]
  ingredientes: { nombre: string; unidad: string | null; precio_unitario: number; vendor: string | null }[]
  recetas: {
    plato: string
    precio_venta: number | null
    raciones_estimadas: number
    lineas: { ingrediente: string; cantidad: number; unidad: string; precio_unitario: number }[]
  }[]
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const payload = await req.json() as CommitPayload
  const userId = user.id

  let provCreados = 0, provExistentes = 0
  let ingCreados = 0, ingActualizados = 0
  let recetasCreadas = 0, lineasCreadas = 0

  const tx = db.transaction(() => {
    // 1. Proveedores
    const proveedorIds: Record<string, number> = {}
    for (const p of payload.proveedores || []) {
      const existing = db.prepare('SELECT id FROM proveedores WHERE user_id=? AND descr=? LIMIT 1').get(userId, p.nombre) as any
      if (existing) {
        proveedorIds[p.nombre] = existing.id
        provExistentes++
      } else {
        const r = db.prepare('INSERT INTO proveedores (user_id, descr, nif) VALUES (?, ?, ?)').run(userId, p.nombre, p.nif)
        proveedorIds[p.nombre] = r.lastInsertRowid as number
        provCreados++
      }
    }

    // 2. Ingredientes (crear si no existen, actualizar coste si sí)
    const ingredienteIds: Record<string, number> = {}
    for (const i of payload.ingredientes || []) {
      const existing = db.prepare('SELECT id FROM ingredientes WHERE user_id=? AND descr=? LIMIT 1').get(userId, i.nombre) as any
      if (existing) {
        db.prepare('UPDATE ingredientes SET cost=?, unit=? WHERE id=?').run(i.precio_unitario, i.unidad, existing.id)
        ingredienteIds[i.nombre] = existing.id
        ingActualizados++
      } else {
        const r = db.prepare('INSERT INTO ingredientes (user_id, descr, unit, cost) VALUES (?, ?, ?, ?)').run(userId, i.nombre, i.unidad, i.precio_unitario)
        ingredienteIds[i.nombre] = r.lastInsertRowid as number
        ingCreados++
      }
      // Registrar también en precio_historial
      db.prepare('INSERT INTO precio_historial (user_id, nombre, vendor, precio, unidad, fuente) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, i.nombre, i.vendor, i.precio_unitario, i.unidad, 'onboarding')
    }

    // 3. Recetas + escandallo
    for (const r of payload.recetas || []) {
      if (!r.lineas || r.lineas.length === 0) continue
      const recetaRes = db.prepare(`
        INSERT INTO escandallo_receta (user_id, nombre, raciones, precio_venta, activo)
        VALUES (?, ?, ?, ?, 1)
      `).run(userId, r.plato, r.raciones_estimadas || 1, r.precio_venta)
      const recetaId = recetaRes.lastInsertRowid as number
      recetasCreadas++

      for (const l of r.lineas) {
        const ingId = ingredienteIds[l.ingrediente] || null
        db.prepare(`
          INSERT INTO escandallo_lineas (receta_id, user_id, ingrediente_id, nombre_libre, cantidad, unidad, coste_unitario)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(recetaId, userId, ingId, ingId ? null : l.ingrediente, l.cantidad, l.unidad, l.precio_unitario)
        lineasCreadas++
      }
    }
  })

  try {
    tx()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error en transacción' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    resumen: {
      proveedores: { creados: provCreados, existentes: provExistentes },
      ingredientes: { creados: ingCreados, actualizados: ingActualizados },
      recetas_creadas: recetasCreadas,
      lineas_escandallo: lineasCreadas,
    },
  })
}
