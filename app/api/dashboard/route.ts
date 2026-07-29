import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { COSTE_LINEA_SQL } from '@/lib/foodcost'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const uid = user.id

  const today = new Date().toISOString().split('T')[0]

  // ── FACTURAS VENCIDAS ─────────────────────────────────────
  const facVencidas = db.prepare(`
    SELECT id, invoice_num, vendor, total, date_due
    FROM facturas_compra
    WHERE user_id=? AND (paid=0 OR paid IS NULL) AND date_due < ?
    ORDER BY date_due ASC LIMIT 20
  `).all(uid, today) as any[]

  const totalVencidas = facVencidas.reduce((s, f) => s + (f.total || 0), 0)

  // ── FACTURAS QUE VENCEN PRONTO (7 días) ──────────────────
  const in7 = new Date()
  in7.setDate(in7.getDate() + 7)
  const in7str = in7.toISOString().split('T')[0]

  const facVencenProx = db.prepare(`
    SELECT id, invoice_num, vendor, total, date_due
    FROM facturas_compra
    WHERE user_id=? AND (paid=0 OR paid IS NULL) AND date_due >= ? AND date_due <= ?
    ORDER BY date_due ASC LIMIT 10
  `).all(uid, today, in7str) as any[]

  const totalVencenProx = facVencenProx.reduce((s, f) => s + (f.total || 0), 0)

  // ── PEDIDOS PENDIENTES ────────────────────────────────────
  const pendEnvio = db.prepare(`
    SELECT id, descr, year, month FROM lista_pedidos WHERE user_id=? AND pending_send>0 LIMIT 10
  `).all(uid) as any[]

  const pendRecepcion = db.prepare(`
    SELECT id, descr FROM lista_pedidos WHERE user_id=? AND pending_receive>0 LIMIT 10
  `).all(uid) as any[]

  // ── INGREDIENTES SIN COSTE ────────────────────────────────
  const sinCoste = db.prepare(`
    SELECT descr FROM ingredientes WHERE user_id=? AND (cost IS NULL OR cost=0) ORDER BY descr LIMIT 10
  `).all(uid) as any[]

  const totalSinCoste = (db.prepare(`SELECT COUNT(*) as c FROM ingredientes WHERE user_id=? AND (cost IS NULL OR cost=0)`).get(uid) as any)?.c ?? 0

  // ── SUBIDAS DE PRECIO RECIENTES ───────────────────────────
  const historial = db.prepare(`
    SELECT nombre, precio, fecha FROM precio_historial WHERE user_id=? ORDER BY nombre, id DESC
  `).all(uid) as any[]

  const precioMap: Record<string, { ultimo: number; anterior: number; fecha: string }> = {}
  for (const p of historial) {
    if (!precioMap[p.nombre]) { precioMap[p.nombre] = { ultimo: p.precio, anterior: p.precio, fecha: p.fecha }; continue }
    precioMap[p.nombre].anterior = p.precio
  }

  const subidas = Object.entries(precioMap)
    .map(([nombre, v]) => {
      const pct = v.anterior > 0 ? Math.round(((v.ultimo - v.anterior) / v.anterior) * 100) : 0
      return { nombre, pct, precio_actual: v.ultimo, fecha: v.fecha }
    })
    .filter(s => s.pct > 7)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5)

  // ── FOOD COST CRÍTICO ─────────────────────────────────────
  const recetasCriticas = db.prepare(`
    SELECT r.nombre, r.precio_venta,
           ROUND(SUM(${COSTE_LINEA_SQL}) / COALESCE(NULLIF(r.raciones, 0), 1), 4) AS coste_racion
    FROM escandallo_receta r
    JOIN escandallo_lineas l ON l.receta_id = r.id AND l.user_id = r.user_id
    LEFT JOIN ingredientes i ON i.id = l.ingrediente_id
    WHERE r.user_id=? AND r.activo=1 AND r.precio_venta>0
    GROUP BY r.id
    HAVING CAST(coste_racion AS REAL) / r.precio_venta > 0.33
       AND CAST(coste_racion AS REAL) / r.precio_venta <= 3
    ORDER BY CAST(coste_racion AS REAL) / r.precio_venta DESC
    LIMIT 5
  `).all(uid) as any[]

  const foodCostCritico = recetasCriticas.map(r => ({
    nombre: r.nombre,
    pct: Math.round((r.coste_racion / r.precio_venta) * 100),
    coste: r.coste_racion,
    pvp: r.precio_venta,
  }))

  // ── MERMA ESTE MES ────────────────────────────────────────
  const mermaMes = db.prepare(`
    SELECT ROUND(SUM(coste_estimado),2) as total, COUNT(*) as eventos,
           GROUP_CONCAT(nombre, ', ') as nombres
    FROM merma_registro
    WHERE user_id=? AND strftime('%Y-%m', fecha)=strftime('%Y-%m','now')
  `).get(uid) as any

  // ── BUILD CARDS ───────────────────────────────────────────
  const cards: any[] = []

  if (facVencidas.length > 0) {
    cards.push({
      id: 'facturas_vencidas',
      tipo: 'danger',
      titulo: `${facVencidas.length} factura${facVencidas.length !== 1 ? 's' : ''} vencida${facVencidas.length !== 1 ? 's' : ''}`,
      detalle: `${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalVencidas)} sin pagar`,
      items: facVencidas.slice(0, 3).map(f => f.vendor || f.invoice_num || '-'),
      mas: Math.max(0, facVencidas.length - 3),
      link: '/dashboard/compras/facturas',
      cta: 'Ver facturas',
      data: facVencidas,
    })
  }

  if (facVencenProx.length > 0) {
    cards.push({
      id: 'facturas_pronto',
      tipo: 'warning',
      titulo: `${facVencenProx.length} factura${facVencenProx.length !== 1 ? 's' : ''} vence${facVencenProx.length === 1 ? '' : 'n'} en 7 días`,
      detalle: `${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalVencenProx)} pendientes`,
      items: facVencenProx.slice(0, 3).map(f => `${f.vendor || '-'} · ${f.date_due}`),
      mas: Math.max(0, facVencenProx.length - 3),
      link: '/dashboard/compras/facturas',
      cta: 'Ver facturas',
      data: facVencenProx,
    })
  }

  if (pendEnvio.length > 0) {
    cards.push({
      id: 'pedidos_envio',
      tipo: 'warning',
      titulo: `${pendEnvio.length} pedido${pendEnvio.length !== 1 ? 's' : ''} pendiente${pendEnvio.length !== 1 ? 's' : ''} de envío`,
      detalle: 'Sin enviar al proveedor',
      items: pendEnvio.slice(0, 3).map(p => p.descr || 'Sin nombre'),
      mas: Math.max(0, pendEnvio.length - 3),
      link: '/dashboard/compras/pedidos',
      cta: 'Ver pedidos',
    })
  }

  if (pendRecepcion.length > 0) {
    cards.push({
      id: 'pedidos_recepcion',
      tipo: 'info',
      titulo: `${pendRecepcion.length} entrega${pendRecepcion.length !== 1 ? 's' : ''} pendiente${pendRecepcion.length !== 1 ? 's' : ''} de confirmar`,
      detalle: 'Entregas aún sin confirmar',
      items: pendRecepcion.slice(0, 3).map(p => p.descr || 'Sin nombre'),
      mas: Math.max(0, pendRecepcion.length - 3),
      link: '/dashboard/compras/pedidos',
      cta: 'Ver pedidos',
    })
  }

  if (subidas.length > 0) {
    cards.push({
      id: 'subidas_precio',
      tipo: 'warning',
      titulo: `${subidas.length} ingrediente${subidas.length !== 1 ? 's' : ''} ha${subidas.length !== 1 ? 'n' : ''} subido de precio`,
      detalle: subidas.slice(0, 3).map(s => `${s.nombre} +${s.pct}%`).join(' · '),
      items: subidas.map(s => `${s.nombre} +${s.pct}%`),
      mas: 0,
      link: '/dashboard/analytics',
      cta: 'Ver desviaciones',
    })
  }

  if (foodCostCritico.length > 0) {
    cards.push({
      id: 'food_cost',
      tipo: 'danger',
      titulo: `${foodCostCritico.length} plato${foodCostCritico.length !== 1 ? 's' : ''} con food cost crítico`,
      detalle: foodCostCritico.slice(0, 2).map(r => `${r.nombre} ${r.pct}%`).join(' · '),
      items: foodCostCritico.map(r => `${r.nombre} ${r.pct}%`),
      mas: 0,
      link: '/dashboard/sangrado',
      cta: 'Ver escandallo',
    })
  }

  if (totalSinCoste > 0) {
    cards.push({
      id: 'sin_coste',
      tipo: 'info',
      titulo: `${totalSinCoste} ingrediente${totalSinCoste !== 1 ? 's' : ''} sin coste registrado`,
      detalle: 'Afecta al cálculo de escandallo',
      items: sinCoste.slice(0, 4).map(i => i.descr),
      mas: Math.max(0, totalSinCoste - 4),
      link: '/dashboard/ingredientes?filtro=sin_coste',
      cta: 'Completar',
    })
  }

  if (mermaMes?.eventos > 0) {
    cards.push({
      id: 'merma',
      tipo: 'info',
      titulo: `${mermaMes.eventos} evento${mermaMes.eventos !== 1 ? 's' : ''} de merma este mes`,
      detalle: `${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(mermaMes.total || 0)} en pérdidas`,
      items: [],
      mas: 0,
      link: '/dashboard/analytics',
      cta: 'Ver merma',
    })
  }

  // ── DATA QUALITY · master data incompleto (feedback P0: pendientes visibles) ──
  const sinProveedor  = (db.prepare(`SELECT COUNT(*) as c FROM ingredientes WHERE user_id=? AND (proveedor_id IS NULL)`).get(uid) as any)?.c ?? 0
  const sinCategoria  = (db.prepare(`SELECT COUNT(*) as c FROM ingredientes WHERE user_id=? AND (type IS NULL OR type='')`).get(uid) as any)?.c ?? 0
  const sinAlmacen    = (db.prepare(`SELECT COUNT(*) as c FROM ingredientes WHERE user_id=? AND (almacen_principal IS NULL OR almacen_principal='')`).get(uid) as any)?.c ?? 0
  const pendientes: string[] = []
  if (sinProveedor > 0) pendientes.push(`${sinProveedor} sin proveedor`)
  if (sinCategoria > 0) pendientes.push(`${sinCategoria} sin categoría`)
  if (sinAlmacen > 0)   pendientes.push(`${sinAlmacen} sin almacén`)
  if (pendientes.length > 0) {
    cards.push({
      id: 'data_quality',
      tipo: 'warning',
      titulo: 'Datos de ingredientes incompletos',
      detalle: 'Bloquean cálculos y pedidos automáticos',
      items: pendientes,
      mas: 0,
      link: sinProveedor > 0 ? '/dashboard/ingredientes?filtro=sin_proveedor' : '/dashboard/ingredientes?filtro=sin_almacen',
      cta: 'Revisar ingredientes',
    })
  }

  return NextResponse.json({ cards, generado: new Date().toISOString() })
}
