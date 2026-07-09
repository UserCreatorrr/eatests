import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { unitFactor } from '@/lib/foodcost'

export const dynamic = 'force-dynamic'

// Guarda el documento validado como TRANSACCIÓN TRAZABLE (diagnóstico P0):
// cabecera + imagen original + líneas vinculadas al documento (con mapeo a
// ingrediente, precio anterior y % cambio) + actualización de costes +
// historial de precios con documento origen + notificación con recetas afectadas.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = user.id

  const { tipo, cabecera, lineas, actualizar_precios, crear_proveedor, image } = await req.json() as any
  const c = cabecera || {}

  const resumen = {
    documento: '',
    doc_tipo: tipo === 'factura' ? 'factura' : 'albaran',
    doc_id: 0,
    proveedor_id: c.proveedor_id ?? null,
    lineas: 0,
    precios_actualizados: 0,
    recetas_afectadas: 0,
    ingredientes_creados: 0,
  }
  const ingredientesActualizados: number[] = []

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

    // Cabecera del documento (con imagen original — no desaparece tras validar)
    if (tipo === 'factura') {
      const r = db.prepare(`INSERT INTO facturas_compra (user_id, invoice_num, vendor, nif, date_invoice, date_due, base, taxes, total, paid, validated, doc_image, source)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, 'scanny')`)
        .run(uid, docNum, c.vendor || null, c.vendor_nif || null, c.fecha || null, c.fecha_vencimiento || null, c.base ?? null, c.iva ?? null, c.total ?? null, image || null)
      resumen.doc_id = r.lastInsertRowid as number
    } else {
      const r = db.prepare(`INSERT INTO albaranes_compra (user_id, delivery_num, vendor, nif, date_delivery, base, taxes, total, doc_image, estado, source)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'validado', 'scanny')`)
        .run(uid, docNum, c.vendor || null, c.vendor_nif || null, c.fecha || null, c.base ?? null, c.iva ?? null, c.total ?? null, image || null)
      resumen.doc_id = r.lastInsertRowid as number
    }

    // Líneas + actualización de precios
    for (const l of (lineas || [])) {
      if (l.excluida) continue

      // Estado actual del ingrediente mapeado (para precio_anterior y almacén destino)
      let ing = l.ingrediente_id
        ? db.prepare('SELECT id, descr, cost, unit, almacen_principal FROM ingredientes WHERE id=? AND user_id=?').get(l.ingrediente_id, uid) as any
        : null

      // Alta directa desde la validación (feedback P0): la línea sin match puede
      // crear el ingrediente en el catálogo, con proveedor y unidad de la compra.
      let esNuevo = false
      if (!ing && l.crear_ingrediente && l.nombre) {
        const r = db.prepare(`INSERT INTO ingredientes (user_id, descr, type, unit, cost, proveedor_id, proveedor_nombre)
                              VALUES (?, ?, 'Ingrediente', ?, NULL, ?, ?)`)
          .run(uid, l.nombre, l.unidad || 'ud', provId, c.vendor || null)
        ing = { id: r.lastInsertRowid as number, descr: l.nombre, cost: null, unit: l.unidad || 'ud', almacen_principal: null }
        esNuevo = true
        resumen.ingredientes_creados++
      }

      // Cambio de precio normalizado a la unidad del ingrediente
      let nuevoCoste: number | null = null
      let cambioPct: number | null = null
      if (ing && l.precio_unitario != null) {
        const factor = unitFactor(l.unidad, ing.unit)
        const nc: number = factor !== 0 ? Math.round((Number(l.precio_unitario) / factor) * 10000) / 10000 : Number(l.precio_unitario)
        nuevoCoste = nc
        if (ing.cost > 0 && Math.abs(nc - ing.cost) > 0.0001) {
          cambioPct = Math.round(((nc - ing.cost) / ing.cost) * 1000) / 10
        }
      }

      db.prepare(`INSERT INTO lineas_albaran_compra
                    (user_id, albaran_id, doc_tipo, doc_id, vendor, nombre, cantidad, unidad, precio_unitario, total_linea, fecha,
                     ingrediente_id, ingrediente_nombre, almacen_destino, precio_anterior, cambio_pct)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          uid,
          tipo === 'factura' ? null : resumen.doc_id,
          resumen.doc_tipo, resumen.doc_id,
          c.vendor || null, l.nombre || null, l.cantidad ?? null, l.unidad ?? null,
          l.precio_unitario ?? null, l.total_linea ?? null, c.fecha || new Date().toISOString().split('T')[0],
          ing?.id ?? null, ing?.descr ?? l.ingrediente_nombre ?? null, ing?.almacen_principal ?? null,
          ing?.cost ?? null, cambioPct,
        )
      resumen.lineas++

      // Actualizar coste del ingrediente + historial (si mapeado y el usuario aceptó;
      // los ingredientes recién creados siempre reciben su primer coste)
      if ((actualizar_precios || esNuevo) && ing && nuevoCoste != null) {
        db.prepare('UPDATE ingredientes SET cost=? WHERE id=? AND user_id=?').run(nuevoCoste, ing.id, uid)
        db.prepare(`INSERT INTO precio_historial (user_id, nombre, vendor, precio, unidad, fuente, ingrediente_id, precio_anterior, doc_tipo, doc_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(uid, ing.descr || l.nombre, c.vendor || null, nuevoCoste, ing.unit, resumen.doc_tipo, ing.id, ing.cost ?? null, resumen.doc_tipo, resumen.doc_id)
        resumen.precios_actualizados++
        if (cambioPct != null) ingredientesActualizados.push(ing.id)
      }
    }

    // Impacto: recetas afectadas por los cambios de precio → notificación accionable
    if (ingredientesActualizados.length > 0) {
      const placeholders = ingredientesActualizados.map(() => '?').join(',')
      const afectadas = db.prepare(`
        SELECT COUNT(DISTINCT l.receta_id) as c
        FROM escandallo_lineas l
        JOIN escandallo_receta r ON r.id = l.receta_id AND r.user_id = l.user_id
        WHERE l.user_id = ? AND r.activo = 1 AND l.ingrediente_id IN (${placeholders})
      `).get(uid, ...ingredientesActualizados) as any
      resumen.recetas_afectadas = afectadas?.c ?? 0

      db.prepare(`INSERT INTO notifications (user_id, type, title, body, urgency, link)
                  VALUES (?, 'precio', ?, ?, ?, ?)`)
        .run(
          uid,
          `${resumen.precios_actualizados} precio(s) actualizados desde ${resumen.documento}`,
          resumen.recetas_afectadas > 0
            ? `${resumen.recetas_afectadas} escandallo(s) afectado(s) por el cambio de coste. Revisa el food cost.`
            : 'Costes de ingredientes actualizados con el documento.',
          resumen.recetas_afectadas > 0 ? 'alta' : 'media',
          `/dashboard/compras/documentos/${resumen.doc_tipo}/${resumen.doc_id}`,
        )
    }
  })

  try { tx() } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  return NextResponse.json({ ok: true, resumen })
}
