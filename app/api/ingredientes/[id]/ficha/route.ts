import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { COSTE_LINEA_SQL } from '@/lib/foodcost'

export const dynamic = 'force-dynamic'

// Ficha viva del ingrediente (diagnóstico P1 alto): quién me lo vende, cuándo
// lo compré, a qué precio, dónde está, en qué recetas se usa y qué historial tiene.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = user.id
  const id = Number(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Id no válido' }, { status: 400 })

  const ingrediente = db.prepare(`
    SELECT i.*, p.descr AS proveedor_descr, p.mail AS proveedor_mail, p.phone AS proveedor_phone
    FROM ingredientes i
    LEFT JOIN proveedores p ON p.id = i.proveedor_id AND p.user_id = i.user_id
    WHERE i.id = ? AND i.user_id = ?
  `).get(id, uid) as any
  if (!ingrediente) return NextResponse.json({ error: 'Ingrediente no encontrado' }, { status: 404 })

  // Últimas compras: líneas de documentos mapeadas a este ingrediente
  // (o, para registros antiguos sin mapeo persistido, por nombre exacto).
  const compras = db.prepare(`
    SELECT id, fecha, vendor, nombre, cantidad, unidad, precio_unitario, total_linea,
           doc_tipo, doc_id, albaran_id, precio_anterior, cambio_pct, almacen_destino
    FROM lineas_albaran_compra
    WHERE user_id = ? AND (ingrediente_id = ? OR (ingrediente_id IS NULL AND nombre = ?))
    ORDER BY fecha DESC, id DESC
    LIMIT 25
  `).all(uid, id, ingrediente.descr || '') as any[]

  // Historial de precios con documento origen
  const precios = db.prepare(`
    SELECT id, fecha, vendor, precio, precio_anterior, unidad, fuente, doc_tipo, doc_id
    FROM precio_historial
    WHERE user_id = ? AND (ingrediente_id = ? OR (ingrediente_id IS NULL AND nombre = ?))
    ORDER BY id DESC
    LIMIT 30
  `).all(uid, id, ingrediente.descr || '') as any[]

  // Recetas donde se usa, con el coste que aporta la línea (unidades normalizadas)
  const recetas = db.prepare(`
    SELECT r.id, r.nombre, r.precio_venta, r.raciones, r.es_subreceta,
           l.cantidad, l.unidad,
           ROUND(${COSTE_LINEA_SQL}, 4) AS coste_linea
    FROM escandallo_lineas l
    JOIN escandallo_receta r ON r.id = l.receta_id AND r.user_id = l.user_id
    LEFT JOIN ingredientes i ON i.id = l.ingrediente_id AND i.user_id = l.user_id
    WHERE l.user_id = ? AND l.ingrediente_id = ? AND r.activo = 1
    ORDER BY r.nombre
  `).all(uid, id) as any[]

  // Mermas registradas de este ingrediente
  const mermas = db.prepare(`
    SELECT id, fecha, cantidad, unidad, motivo, coste_estimado
    FROM merma_registro
    WHERE user_id = ? AND (ingrediente_id = ? OR (ingrediente_id IS NULL AND nombre = ?))
    ORDER BY fecha DESC, id DESC
    LIMIT 15
  `).all(uid, id, ingrediente.descr || '') as any[]

  // Alertas operativas de la ficha
  const alertas: { tipo: 'danger' | 'warning' | 'info'; texto: string }[] = []
  if (ingrediente.cost == null || ingrediente.cost <= 0) alertas.push({ tipo: 'danger', texto: 'Sin coste definido: los escandallos que lo usan calculan mal el food cost.' })
  if (!ingrediente.proveedor_id) alertas.push({ tipo: 'warning', texto: 'Sin proveedor asignado.' })
  if (!ingrediente.almacen_principal) alertas.push({ tipo: 'warning', texto: 'Sin almacén asignado.' })
  const ultimo = precios[0]
  if (ultimo?.precio_anterior != null && ultimo.precio_anterior > 0) {
    const d = ((ultimo.precio - ultimo.precio_anterior) / ultimo.precio_anterior) * 100
    if (d >= 10) alertas.push({ tipo: 'warning', texto: `Última compra con subida de precio del ${Math.round(d)}%. ${recetas.length > 0 ? `Afecta a ${recetas.length} escandallo(s).` : ''}` })
  }
  if (compras.length === 0) alertas.push({ tipo: 'info', texto: 'Sin compras registradas todavía.' })

  return NextResponse.json({ ingrediente, compras, precios, recetas, mermas, alertas })
}
