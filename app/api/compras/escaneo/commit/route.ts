import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { unitFactor } from '@/lib/foodcost'

export const dynamic = 'force-dynamic'

// Guarda el documento validado: crea albarán/factura + líneas, y opcionalmente
// actualiza el coste del ingrediente + precio_historial cuando el usuario lo acepta.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = user.id

  const { tipo, cabecera, lineas, actualizar_precios, crear_proveedor } = await req.json() as any
  const c = cabecera || {}

  let resumen = { documento: '', proveedor_id: c.proveedor_id ?? null, lineas: 0, precios_actualizados: 0 }

  const tx = db.transaction(() => {
    // Proveedor nuevo
    let provId = c.proveedor_id ?? null
    if (!provId && crear_proveedor && c.vendor) {
      const r = db.prepare('INSERT INTO proveedores (user_id, descr, nif) VALUES (?, ?, ?)').run(uid, c.vendor, c.vendor_nif || null)
      provId = r.lastInsertRowid as number
      resumen.proveedor_id = provId
    }

    // Número de documento autogenerado si falta
    const hoy = new Date()
    const ymd = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`
    const prefix = tipo === 'factura' ? 'FAC' : 'ALB'
    let docNum = c.doc_num
    if (!docNum) {
      const tbl = tipo === 'factura' ? 'facturas_compra' : 'albaranes_compra'
      const col = tipo === 'factura' ? 'invoice_num' : 'delivery_num'
      const n = (db.prepare(`SELECT COUNT(*) as c FROM ${tbl} WHERE user_id=? AND ${col} LIKE ?`).get(uid, `${prefix}-${ymd}-%`) as any)?.c ?? 0
      docNum = `${prefix}-${ymd}-${String(n + 1).padStart(3, '0')}`
    }
    resumen.documento = docNum

    // Cabecera del documento
    if (tipo === 'factura') {
      db.prepare(`INSERT INTO facturas_compra (user_id, invoice_num, vendor, nif, date_invoice, date_due, base, taxes, total, paid, validated)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`)
        .run(uid, docNum, c.vendor || null, c.vendor_nif || null, c.fecha || null, c.fecha_vencimiento || null, c.base ?? null, c.iva ?? null, c.total ?? null)
    } else {
      db.prepare(`INSERT INTO albaranes_compra (user_id, delivery_num, vendor, nif, date_delivery, base, taxes, total)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(uid, docNum, c.vendor || null, c.vendor_nif || null, c.fecha || null, c.base ?? null, c.iva ?? null, c.total ?? null)
    }

    // Líneas + actualización de precios
    for (const l of (lineas || [])) {
      if (l.excluida) continue
      db.prepare(`INSERT INTO lineas_albaran_compra (user_id, vendor, nombre, cantidad, unidad, precio_unitario, total_linea, fecha)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(uid, c.vendor || null, l.nombre || null, l.cantidad ?? null, l.unidad ?? null, l.precio_unitario ?? null, l.total_linea ?? null, c.fecha || new Date().toISOString().split('T')[0])
      resumen.lineas++

      // Actualizar coste del ingrediente + historial (solo si mapeado, con cambio, y el usuario aceptó)
      if (actualizar_precios && l.ingrediente_id && l.precio_unitario != null) {
        const ing = db.prepare('SELECT cost, unit FROM ingredientes WHERE id=? AND user_id=?').get(l.ingrediente_id, uid) as any
        if (ing) {
          const factor = unitFactor(l.unidad, ing.unit)
          const nuevoCoste = factor !== 0 ? Math.round((l.precio_unitario / factor) * 10000) / 10000 : l.precio_unitario
          db.prepare('UPDATE ingredientes SET cost=? WHERE id=? AND user_id=?').run(nuevoCoste, l.ingrediente_id, uid)
          db.prepare('INSERT INTO precio_historial (user_id, nombre, vendor, precio, unidad, fuente) VALUES (?, ?, ?, ?, ?, ?)')
            .run(uid, l.ingrediente_nombre || l.nombre, c.vendor || null, nuevoCoste, ing.unit, tipo === 'factura' ? 'factura' : 'albaran')
          resumen.precios_actualizados++
        }
      }
    }
  })

  try { tx() } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  return NextResponse.json({ ok: true, resumen })
}
