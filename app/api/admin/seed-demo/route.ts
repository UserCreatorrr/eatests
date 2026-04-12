import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.INGEST_SECRET) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const uid = 'pablo-admin'
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d) }
  const monthsAgo = (n: number) => { const d = new Date(today); d.setMonth(d.getMonth() - n); return fmt(d) }

  // ── PRECIO HISTORIAL (para desviaciones) ──────────────────
  const precios = [
    // Aceite de oliva: subida brutal
    { nombre: 'Aceite de oliva virgen extra', vendor: 'Aceites García', precio: 4.20, unidad: 'l', fecha: monthsAgo(3), fuente: 'albaran' },
    { nombre: 'Aceite de oliva virgen extra', vendor: 'Aceites García', precio: 4.80, unidad: 'l', fecha: monthsAgo(2), fuente: 'albaran' },
    { nombre: 'Aceite de oliva virgen extra', vendor: 'Aceites García', precio: 5.60, unidad: 'l', fecha: monthsAgo(1), fuente: 'albaran' },
    { nombre: 'Aceite de oliva virgen extra', vendor: 'Aceites García', precio: 6.20, unidad: 'l', fecha: daysAgo(10), fuente: 'albaran' },

    // Salmón: subida moderada
    { nombre: 'Salmón fresco', vendor: 'Pescados Atlántico', precio: 12.50, unidad: 'kg', fecha: monthsAgo(2), fuente: 'albaran' },
    { nombre: 'Salmón fresco', vendor: 'Pescados Atlántico', precio: 13.80, unidad: 'kg', fecha: monthsAgo(1), fuente: 'albaran' },
    { nombre: 'Salmón fresco', vendor: 'Pescados Atlántico', precio: 15.20, unidad: 'kg', fecha: daysAgo(5), fuente: 'albaran' },

    // Harina: estable
    { nombre: 'Harina de trigo T55', vendor: 'Harinera del Norte', precio: 0.85, unidad: 'kg', fecha: monthsAgo(3), fuente: 'albaran' },
    { nombre: 'Harina de trigo T55', vendor: 'Harinera del Norte', precio: 0.87, unidad: 'kg', fecha: monthsAgo(1), fuente: 'albaran' },

    // Pechuga de pollo: bajada
    { nombre: 'Pechuga de pollo', vendor: 'Carnes Selectas SA', precio: 6.80, unidad: 'kg', fecha: monthsAgo(2), fuente: 'albaran' },
    { nombre: 'Pechuga de pollo', vendor: 'Carnes Selectas SA', precio: 6.20, unidad: 'kg', fecha: daysAgo(15), fuente: 'albaran' },

    // Nata líquida: subida
    { nombre: 'Nata líquida 35%', vendor: 'Lácteos Frescos SL', precio: 1.90, unidad: 'l', fecha: monthsAgo(2), fuente: 'albaran' },
    { nombre: 'Nata líquida 35%', vendor: 'Lácteos Frescos SL', precio: 2.30, unidad: 'l', fecha: daysAgo(20), fuente: 'albaran' },
  ]

  for (const p of precios) {
    db.prepare(`INSERT INTO precio_historial (user_id, nombre, vendor, precio, unidad, fecha, fuente) VALUES (?,?,?,?,?,?,?)`)
      .run(uid, p.nombre, p.vendor, p.precio, p.unidad, p.fecha, p.fuente)
  }

  // ── LINEAS ALBARAN (inconsistencias entre proveedores) ────
  const lineas = [
    // Mismo producto, distintos proveedores a distintos precios
    { vendor: 'Mercabarna Express', nombre: 'Tomate rama', cantidad: 20, unidad: 'kg', precio_unitario: 1.80, total_linea: 36.00, fecha: daysAgo(8) },
    { vendor: 'Frutas y Verduras Pep', nombre: 'Tomate rama', cantidad: 15, unidad: 'kg', precio_unitario: 2.40, total_linea: 36.00, fecha: daysAgo(3) },

    { vendor: 'Aceites García', nombre: 'Aceite de oliva virgen extra', cantidad: 10, unidad: 'l', precio_unitario: 6.20, total_linea: 62.00, fecha: daysAgo(10) },
    { vendor: 'Distribuciones Roca', nombre: 'Aceite de oliva virgen extra', cantidad: 10, unidad: 'l', precio_unitario: 4.90, total_linea: 49.00, fecha: daysAgo(12) },

    { vendor: 'Pescados Atlántico', nombre: 'Salmón fresco', cantidad: 5, unidad: 'kg', precio_unitario: 15.20, total_linea: 76.00, fecha: daysAgo(5) },
    { vendor: 'Pescados del Mediterráneo', nombre: 'Salmón fresco', cantidad: 5, unidad: 'kg', precio_unitario: 12.80, total_linea: 64.00, fecha: daysAgo(7) },

    // Más líneas para datos de consumo real
    { vendor: 'Carnes Selectas SA', nombre: 'Pechuga de pollo', cantidad: 10, unidad: 'kg', precio_unitario: 6.20, total_linea: 62.00, fecha: daysAgo(4) },
    { vendor: 'Lácteos Frescos SL', nombre: 'Nata líquida 35%', cantidad: 8, unidad: 'l', precio_unitario: 2.30, total_linea: 18.40, fecha: daysAgo(6) },
    { vendor: 'Harinera del Norte', nombre: 'Harina de trigo T55', cantidad: 25, unidad: 'kg', precio_unitario: 0.87, total_linea: 21.75, fecha: daysAgo(9) },
  ]

  for (const l of lineas) {
    db.prepare(`INSERT INTO lineas_albaran_compra (user_id, vendor, nombre, cantidad, unidad, precio_unitario, total_linea, fecha) VALUES (?,?,?,?,?,?,?,?)`)
      .run(uid, l.vendor, l.nombre, l.cantidad, l.unidad, l.precio_unitario, l.total_linea, l.fecha)
  }

  // ── MERMA REGISTRO ────────────────────────────────────────
  const mermas = [
    // Este mes
    { nombre: 'Salmón fresco', cantidad: 1.2, unidad: 'kg', motivo: 'caducidad', coste_estimado: 18.24, fecha: daysAgo(2), notas: 'Llegó en mal estado' },
    { nombre: 'Tomate rama', cantidad: 3.5, unidad: 'kg', motivo: 'caducidad', coste_estimado: 6.30, fecha: daysAgo(4), notas: 'Sobrestock fin de semana' },
    { nombre: 'Nata líquida 35%', cantidad: 2, unidad: 'l', motivo: 'sobreproducción', coste_estimado: 4.60, fecha: daysAgo(5), notas: 'Exceso mise en place' },
    { nombre: 'Pan de molde', cantidad: 1, unidad: 'ud', motivo: 'caducidad', coste_estimado: 2.80, fecha: daysAgo(6) },
    { nombre: 'Costilla de cerdo', cantidad: 0.8, unidad: 'kg', motivo: 'rotura', coste_estimado: 6.40, fecha: daysAgo(8), notas: 'Caída en cámara' },
    { nombre: 'Pechuga de pollo', cantidad: 0.5, unidad: 'kg', motivo: 'pérdida', coste_estimado: 3.10, fecha: daysAgo(10) },
    { nombre: 'Aceite de oliva virgen extra', cantidad: 0.5, unidad: 'l', motivo: 'rotura', coste_estimado: 3.10, fecha: daysAgo(12), notas: 'Botella rota en servicio' },
    { nombre: 'Gambas', cantidad: 0.3, unidad: 'kg', motivo: 'caducidad', coste_estimado: 5.40, fecha: daysAgo(14) },
    { nombre: 'Merluza', cantidad: 0.6, unidad: 'kg', motivo: 'sobreproducción', coste_estimado: 4.80, fecha: daysAgo(3) },
    { nombre: 'Fresas', cantidad: 0.4, unidad: 'kg', motivo: 'caducidad', coste_estimado: 2.00, fecha: daysAgo(1) },
    // Mes anterior
    { nombre: 'Bacalao', cantidad: 0.8, unidad: 'kg', motivo: 'caducidad', coste_estimado: 9.60, fecha: monthsAgo(1), notas: 'Descongelación involuntaria' },
    { nombre: 'Lechuga', cantidad: 2, unidad: 'ud', motivo: 'caducidad', coste_estimado: 3.20, fecha: monthsAgo(1) },
    { nombre: 'Huevos', cantidad: 6, unidad: 'ud', motivo: 'rotura', coste_estimado: 1.80, fecha: monthsAgo(1) },
  ]

  for (const m of mermas) {
    db.prepare(`INSERT INTO merma_registro (user_id, nombre, cantidad, unidad, motivo, coste_estimado, fecha, notas) VALUES (?,?,?,?,?,?,?,?)`)
      .run(uid, m.nombre, m.cantidad, m.unidad, m.motivo, m.coste_estimado, m.fecha, m.notas || null)
  }

  // ── ESCANDALLO RECETAS (para consumo teórico) ─────────────
  const recetas = [
    { nombre: 'Salmón a la plancha con verduras', categoria: 'Segundos', raciones: 4, precio_venta: 22.00, merma_pct: 8 },
    { nombre: 'Crema de tomate', categoria: 'Primeros', raciones: 6, precio_venta: 9.50, merma_pct: 5 },
    { nombre: 'Pechuga de pollo a la mediterránea', categoria: 'Segundos', raciones: 4, precio_venta: 16.50, merma_pct: 6 },
    { nombre: 'Tarta de nata y fresas', categoria: 'Postres', raciones: 8, precio_venta: 7.50, merma_pct: 10 },
  ]

  const recetaIds: Record<string, number> = {}
  for (const r of recetas) {
    const existing = db.prepare('SELECT id FROM escandallo_receta WHERE user_id=? AND nombre=?').get(uid, r.nombre) as any
    if (!existing) {
      const res = db.prepare(`INSERT INTO escandallo_receta (user_id, nombre, categoria, raciones, precio_venta, merma_pct, activo) VALUES (?,?,?,?,?,?,1)`)
        .run(uid, r.nombre, r.categoria, r.raciones, r.precio_venta, r.merma_pct)
      recetaIds[r.nombre] = res.lastInsertRowid as number
    } else {
      recetaIds[r.nombre] = existing.id
    }
  }

  // Líneas de escandallo
  const lineasEscandallo = [
    { receta: 'Salmón a la plancha con verduras', ingredientes: [
      { nombre_libre: 'Salmón fresco', cantidad: 0.18, unidad: 'kg', coste_unitario: 15.20 },
      { nombre_libre: 'Aceite de oliva virgen extra', cantidad: 0.03, unidad: 'l', coste_unitario: 6.20 },
      { nombre_libre: 'Tomate rama', cantidad: 0.08, unidad: 'kg', coste_unitario: 1.80 },
      { nombre_libre: 'Pimiento rojo', cantidad: 0.06, unidad: 'kg', coste_unitario: 1.20 },
    ]},
    { receta: 'Crema de tomate', ingredientes: [
      { nombre_libre: 'Tomate rama', cantidad: 0.15, unidad: 'kg', coste_unitario: 1.80 },
      { nombre_libre: 'Nata líquida 35%', cantidad: 0.05, unidad: 'l', coste_unitario: 2.30 },
      { nombre_libre: 'Cebolla', cantidad: 0.04, unidad: 'kg', coste_unitario: 0.60 },
      { nombre_libre: 'Aceite de oliva virgen extra', cantidad: 0.02, unidad: 'l', coste_unitario: 6.20 },
    ]},
    { receta: 'Pechuga de pollo a la mediterránea', ingredientes: [
      { nombre_libre: 'Pechuga de pollo', cantidad: 0.20, unidad: 'kg', coste_unitario: 6.20 },
      { nombre_libre: 'Aceite de oliva virgen extra', cantidad: 0.02, unidad: 'l', coste_unitario: 6.20 },
      { nombre_libre: 'Tomate rama', cantidad: 0.10, unidad: 'kg', coste_unitario: 1.80 },
    ]},
    { receta: 'Tarta de nata y fresas', ingredientes: [
      { nombre_libre: 'Nata líquida 35%', cantidad: 0.12, unidad: 'l', coste_unitario: 2.30 },
      { nombre_libre: 'Harina de trigo T55', cantidad: 0.08, unidad: 'kg', coste_unitario: 0.87 },
      { nombre_libre: 'Fresas', cantidad: 0.06, unidad: 'kg', coste_unitario: 5.00 },
    ]},
  ]

  for (const le of lineasEscandallo) {
    const rid = recetaIds[le.receta]
    if (!rid) continue
    db.prepare('DELETE FROM escandallo_lineas WHERE receta_id=? AND user_id=?').run(rid, uid)
    for (const ing of le.ingredientes) {
      db.prepare(`INSERT INTO escandallo_lineas (receta_id, user_id, nombre_libre, cantidad, unidad, coste_unitario) VALUES (?,?,?,?,?,?)`)
        .run(rid, uid, ing.nombre_libre, ing.cantidad, ing.unidad, ing.coste_unitario)
    }
  }

  // ── PRODUCCIÓN (para consumo teórico) ────────────────────
  const produccion = [
    { nombre: 'Salmón a la plancha con verduras', raciones: 32, fecha: daysAgo(1) },
    { nombre: 'Salmón a la plancha con verduras', raciones: 28, fecha: daysAgo(2) },
    { nombre: 'Crema de tomate', raciones: 45, fecha: daysAgo(1) },
    { nombre: 'Crema de tomate', raciones: 38, fecha: daysAgo(2) },
    { nombre: 'Pechuga de pollo a la mediterránea', raciones: 24, fecha: daysAgo(1) },
    { nombre: 'Tarta de nata y fresas', raciones: 20, fecha: daysAgo(1) },
    { nombre: 'Tarta de nata y fresas', raciones: 18, fecha: daysAgo(2) },
  ]

  for (const p of produccion) {
    const rid = recetaIds[p.nombre] ?? null
    db.prepare(`INSERT INTO ventas_produccion (user_id, receta_id, nombre, raciones, fecha) VALUES (?,?,?,?,?)`)
      .run(uid, rid, p.nombre, p.raciones, p.fecha)
  }

  return NextResponse.json({
    ok: true,
    insertados: {
      precio_historial: precios.length,
      lineas_albaran: lineas.length,
      merma: mermas.length,
      recetas: recetas.length,
      produccion: produccion.length,
    }
  })
}
