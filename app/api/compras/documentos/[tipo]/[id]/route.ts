import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Detalle completo de un documento de compra (P0 trazabilidad):
// cabecera, documento original (imagen), líneas con mapeo a ingrediente,
// historial de precios creado por este documento y escandallos afectados.
export async function GET(req: NextRequest, { params }: { params: { tipo: string; id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = user.id

  const tipo = params.tipo === 'factura' ? 'factura' : params.tipo === 'albaran' ? 'albaran' : null
  const id = Number(params.id)
  if (!tipo || !Number.isFinite(id)) return NextResponse.json({ error: 'Documento no válido' }, { status: 400 })

  const cabecera = tipo === 'factura'
    ? db.prepare(`SELECT id, invoice_num AS num, vendor, nif, date_invoice AS fecha, date_due AS fecha_vencimiento,
                         base, taxes, total, paid, validated, doc_image, source
                  FROM facturas_compra WHERE id=? AND user_id=?`).get(id, uid) as any
    : db.prepare(`SELECT id, delivery_num AS num, vendor, nif, date_delivery AS fecha, NULL AS fecha_vencimiento,
                         base, taxes, total, NULL AS paid, 1 AS validated, doc_image, estado, source
                  FROM albaranes_compra WHERE id=? AND user_id=?`).get(id, uid) as any

  if (!cabecera) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  // Líneas del documento. Documentos antiguos de albarán (pre-trazabilidad) se
  // enlazaban solo por albaran_id; los nuevos llevan doc_tipo + doc_id.
  const lineas = db.prepare(`
    SELECT l.*, i.descr AS ing_descr, i.unit AS ing_unit, i.cost AS ing_cost_actual, i.almacen_principal AS ing_almacen
    FROM lineas_albaran_compra l
    LEFT JOIN ingredientes i ON i.id = l.ingrediente_id AND i.user_id = l.user_id
    WHERE l.user_id = ?
      AND ((l.doc_tipo = ? AND l.doc_id = ?) ${tipo === 'albaran' ? 'OR (l.doc_tipo IS NULL AND l.albaran_id = ?)' : ''})
    ORDER BY l.id ASC
  `).all(...(tipo === 'albaran' ? [uid, tipo, id, id] : [uid, tipo, id])) as any[]

  // Historial de precios generado por este documento
  const precios = db.prepare(`
    SELECT id, nombre, ingrediente_id, precio_anterior, precio, unidad, fecha
    FROM precio_historial
    WHERE user_id = ? AND doc_tipo = ? AND doc_id = ?
    ORDER BY id ASC
  `).all(uid, tipo, id) as any[]

  // Escandallos afectados por los ingredientes cuyo coste cambió
  const ingIds = precios.filter(p => p.ingrediente_id != null && p.precio_anterior != null && p.precio_anterior !== p.precio).map(p => p.ingrediente_id)
  let recetas: any[] = []
  if (ingIds.length > 0) {
    const ph = ingIds.map(() => '?').join(',')
    recetas = db.prepare(`
      SELECT DISTINCT r.id, r.nombre, r.precio_venta, r.raciones
      FROM escandallo_receta r
      JOIN escandallo_lineas l ON l.receta_id = r.id AND l.user_id = r.user_id
      WHERE r.user_id = ? AND r.activo = 1 AND l.ingrediente_id IN (${ph})
      ORDER BY r.nombre
    `).all(uid, ...ingIds) as any[]
  }

  return NextResponse.json({ tipo, cabecera, lineas, impacto: { precios, recetas } })
}
