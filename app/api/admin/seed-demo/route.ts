import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.INGEST_SECRET) return new NextResponse('Forbidden', { status: 403 })

  const uid = 'pablo-admin'
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const dAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d) }
  const mAgo = (n: number) => { const d = new Date(today); d.setMonth(d.getMonth() - n); return fmt(d) }

  // Clear existing demo data
  const tables = ['ingredientes','herramientas','proveedores','lista_pedidos','pedidos_compra','albaranes_compra','facturas_compra','albaranes_venta','facturas_venta','escandallo_receta','escandallo_lineas','precio_historial','merma_registro','lineas_albaran_compra','ventas_produccion']
  for (const t of tables) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(uid)

  // ── PROVEEDORES ───────────────────────────────────────────
  const proveedores = [
    { codi: 'PROV001', descr: 'Mercabarna Express SL', descr_type: 'Frutas y Verduras', mail: 'pedidos@mercabarnaexpress.com', phone: '932 445 678', nif: 'B12345678', city: 'Barcelona', cp: '08040' },
    { codi: 'PROV002', descr: 'Pescados del Atlántico SA', descr_type: 'Pescadería', mail: 'comercial@pescadosatlantico.es', phone: '981 334 556', nif: 'A87654321', city: 'A Coruña', cp: '15001' },
    { codi: 'PROV003', descr: 'Carnes Selectas Martínez', descr_type: 'Carnicería', mail: 'info@carnesmartinez.com', phone: '934 112 890', nif: 'B98765432', city: 'Vic', cp: '08500' },
    { codi: 'PROV004', descr: 'Lácteos Frescos del Pirineo', descr_type: 'Lácteos', mail: 'ventas@lacteosfrescos.es', phone: '974 223 445', nif: 'B11223344', city: 'Lleida', cp: '25001' },
    { codi: 'PROV005', descr: 'Aceites García e Hijos', descr_type: 'Aceites y Conservas', mail: 'pedidos@aceitesgarcia.com', phone: '953 778 900', nif: 'B55667788', city: 'Jaén', cp: '23001' },
    { codi: 'PROV006', descr: 'Harinera del Norte SL', descr_type: 'Harinas y Cereales', mail: 'info@harineranorte.com', phone: '944 556 123', nif: 'B33445566', city: 'Bilbao', cp: '48001' },
    { codi: 'PROV007', descr: 'Bodegas Rioja Premium', descr_type: 'Bebidas y Vinos', mail: 'export@bodegasrioja.com', phone: '941 223 334', nif: 'A22334455', city: 'Logroño', cp: '26001' },
    { codi: 'PROV008', descr: 'Distribuciones Roca Alimentación', descr_type: 'Distribuidor General', mail: 'pedidos@distrroca.com', phone: '936 789 012', nif: 'B77889900', city: 'Sabadell', cp: '08201' },
  ]
  const provIds: Record<string, number> = {}
  for (const p of proveedores) {
    const r = db.prepare(`INSERT INTO proveedores (user_id,codi,descr,descr_type,mail,phone,nif,city,cp,defecte,locked,replicated) VALUES (?,?,?,?,?,?,?,?,?,0,0,0)`).run(uid,p.codi,p.descr,p.descr_type,p.mail,p.phone,p.nif,p.city,p.cp)
    provIds[p.codi] = r.lastInsertRowid as number
  }

  // ── INGREDIENTES ──────────────────────────────────────────
  const ingredientes = [
    // Proteínas
    { codi:'ING001', descr:'Salmón fresco', type:'Pescado', unit:'kg', cost:15.20 },
    { codi:'ING002', descr:'Merluza fresca', type:'Pescado', unit:'kg', cost:9.80 },
    { codi:'ING003', descr:'Gambas rojas', type:'Marisco', unit:'kg', cost:28.50 },
    { codi:'ING004', descr:'Pulpo cocido', type:'Marisco', unit:'kg', cost:12.40 },
    { codi:'ING005', descr:'Bacalao desalado', type:'Pescado', unit:'kg', cost:11.60 },
    { codi:'ING006', descr:'Pechuga de pollo', type:'Carne', unit:'kg', cost:6.20 },
    { codi:'ING007', descr:'Solomillo de ternera', type:'Carne', unit:'kg', cost:32.00 },
    { codi:'ING008', descr:'Costilla de cerdo', type:'Carne', unit:'kg', cost:5.80 },
    { codi:'ING009', descr:'Muslo de pato confitado', type:'Carne', unit:'ud', cost:4.50 },
    { codi:'ING010', descr:'Foie gras mi-cuit', type:'Charcutería', unit:'kg', cost:68.00 },
    // Verduras
    { codi:'ING011', descr:'Tomate rama', type:'Verdura', unit:'kg', cost:1.80 },
    { codi:'ING012', descr:'Pimiento rojo', type:'Verdura', unit:'kg', cost:1.40 },
    { codi:'ING013', descr:'Pimiento verde', type:'Verdura', unit:'kg', cost:1.20 },
    { codi:'ING014', descr:'Cebolla blanca', type:'Verdura', unit:'kg', cost:0.60 },
    { codi:'ING015', descr:'Ajo', type:'Verdura', unit:'kg', cost:3.20 },
    { codi:'ING016', descr:'Patata agria', type:'Verdura', unit:'kg', cost:0.55 },
    { codi:'ING017', descr:'Espárrago verde', type:'Verdura', unit:'kg', cost:4.80 },
    { codi:'ING018', descr:'Berenjena', type:'Verdura', unit:'kg', cost:1.10 },
    { codi:'ING019', descr:'Calabacín', type:'Verdura', unit:'kg', cost:0.90 },
    { codi:'ING020', descr:'Champiñón laminado', type:'Hongo', unit:'kg', cost:2.40 },
    { codi:'ING021', descr:'Trufa negra rallada', type:'Hongo', unit:'g', cost:0.85 },
    // Lácteos
    { codi:'ING022', descr:'Nata líquida 35%', type:'Lácteo', unit:'l', cost:2.30 },
    { codi:'ING023', descr:'Mantequilla sin sal', type:'Lácteo', unit:'kg', cost:8.40 },
    { codi:'ING024', descr:'Queso parmesano', type:'Lácteo', unit:'kg', cost:18.50 },
    { codi:'ING025', descr:'Queso manchego curado', type:'Lácteo', unit:'kg', cost:14.20 },
    { codi:'ING026', descr:'Huevos camperos L', type:'Lácteo', unit:'ud', cost:0.28 },
    // Despensa
    { codi:'ING027', descr:'Aceite de oliva virgen extra', type:'Aceite', unit:'l', cost:6.20 },
    { codi:'ING028', descr:'Harina de trigo T55', type:'Harina', unit:'kg', cost:0.87 },
    { codi:'ING029', descr:'Arroz bomba', type:'Cereal', unit:'kg', cost:2.10 },
    { codi:'ING030', descr:'Pasta fresca tagliatelle', type:'Pasta', unit:'kg', cost:3.40 },
    { codi:'ING031', descr:'Caldo de pollo', type:'Caldo', unit:'l', cost:1.20 },
    { codi:'ING032', descr:'Vino blanco Albariño', type:'Vino', unit:'l', cost:4.80 },
    { codi:'ING033', descr:'Azúcar blanco', type:'Azúcar', unit:'kg', cost:0.95 },
    { codi:'ING034', descr:'Sal marina fina', type:'Condimento', unit:'kg', cost:0.40 },
    { codi:'ING035', descr:'Pimienta negra molida', type:'Especia', unit:'kg', cost:12.00 },
    { codi:'ING036', descr:'Azafrán', type:'Especia', unit:'g', cost:0.28 },
    { codi:'ING037', descr:'Pimentón ahumado', type:'Especia', unit:'kg', cost:8.50 },
    { codi:'ING038', descr:'Fresas frescas', type:'Fruta', unit:'kg', cost:5.00 },
    { codi:'ING039', descr:'Limón', type:'Fruta', unit:'kg', cost:1.40 },
    { codi:'ING040', descr:'Chocolate negro 70%', type:'Repostería', unit:'kg', cost:11.20 },
  ]
  for (const i of ingredientes) {
    db.prepare(`INSERT INTO ingredientes (user_id,codi,descr,type,unit,cost,has_data) VALUES (?,?,?,?,?,?,1)`).run(uid,i.codi,i.descr,i.type,i.unit,i.cost)
  }

  // ── HERRAMIENTAS ──────────────────────────────────────────
  const herramientas = [
    { codi:'HER001', descr:'Termómetro digital cocina', type:'Utensilio', unit:'ud', cost:45.00 },
    { codi:'HER002', descr:'Sartén antiadherente 28cm', type:'Utensilio', unit:'ud', cost:38.00 },
    { codi:'HER003', descr:'Robot de cocina Thermomix', type:'Maquinaria', unit:'ud', cost:1200.00 },
    { codi:'HER004', descr:'Batidora de brazo', type:'Maquinaria', unit:'ud', cost:180.00 },
    { codi:'HER005', descr:'Tabla de corte HACCP verde', type:'Utensilio', unit:'ud', cost:22.00 },
  ]
  for (const h of herramientas) {
    db.prepare(`INSERT INTO herramientas (user_id,codi,descr,type,unit,cost,has_data) VALUES (?,?,?,?,?,?,1)`).run(uid,h.codi,h.descr,h.type,h.unit,h.cost)
  }

  // ── PEDIDOS COMPRA ────────────────────────────────────────
  const pedidos = [
    // Este mes
    { num_order:'PED-2026-0412', vendor:'Mercabarna Express SL', code_vendor:'PROV001', date_order:dAgo(1), date_reception:dAgo(0), total:342.80 },
    { num_order:'PED-2026-0411', vendor:'Pescados del Atlántico SA', code_vendor:'PROV002', date_order:dAgo(2), date_reception:dAgo(1), total:687.40 },
    { num_order:'PED-2026-0410', vendor:'Carnes Selectas Martínez', code_vendor:'PROV003', date_order:dAgo(3), date_reception:dAgo(2), total:524.60 },
    { num_order:'PED-2026-0409', vendor:'Lácteos Frescos del Pirineo', code_vendor:'PROV004', date_order:dAgo(5), date_reception:dAgo(4), total:198.30 },
    { num_order:'PED-2026-0408', vendor:'Aceites García e Hijos', code_vendor:'PROV005', date_order:dAgo(6), date_reception:dAgo(5), total:413.00 },
    { num_order:'PED-2026-0407', vendor:'Mercabarna Express SL', code_vendor:'PROV001', date_order:dAgo(8), date_reception:dAgo(7), total:289.50 },
    { num_order:'PED-2026-0406', vendor:'Harinera del Norte SL', code_vendor:'PROV006', date_order:dAgo(9), date_reception:dAgo(8), total:156.75 },
    { num_order:'PED-2026-0405', vendor:'Bodegas Rioja Premium', code_vendor:'PROV007', date_order:dAgo(10), date_reception:dAgo(9), total:892.00 },
    { num_order:'PED-2026-0404', vendor:'Pescados del Atlántico SA', code_vendor:'PROV002', date_order:dAgo(12), date_reception:dAgo(11), total:445.20 },
    { num_order:'PED-2026-0403', vendor:'Distribuciones Roca Alimentación', code_vendor:'PROV008', date_order:dAgo(14), date_reception:dAgo(13), total:678.90 },
    // Mes anterior
    { num_order:'PED-2026-0322', vendor:'Mercabarna Express SL', code_vendor:'PROV001', date_order:mAgo(1), date_reception:mAgo(1), total:318.40 },
    { num_order:'PED-2026-0321', vendor:'Carnes Selectas Martínez', code_vendor:'PROV003', date_order:mAgo(1), date_reception:mAgo(1), total:612.80 },
    { num_order:'PED-2026-0320', vendor:'Pescados del Atlántico SA', code_vendor:'PROV002', date_order:mAgo(1), date_reception:mAgo(1), total:523.10 },
    { num_order:'PED-2026-0319', vendor:'Aceites García e Hijos', code_vendor:'PROV005', date_order:mAgo(1), date_reception:mAgo(1), total:310.00 },
    { num_order:'PED-2026-0318', vendor:'Bodegas Rioja Premium', code_vendor:'PROV007', date_order:mAgo(1), date_reception:mAgo(1), total:760.00 },
    // 2 meses atrás
    { num_order:'PED-2026-0218', vendor:'Mercabarna Express SL', code_vendor:'PROV001', date_order:mAgo(2), date_reception:mAgo(2), total:298.60 },
    { num_order:'PED-2026-0217', vendor:'Carnes Selectas Martínez', code_vendor:'PROV003', date_order:mAgo(2), date_reception:mAgo(2), total:580.00 },
    { num_order:'PED-2026-0216', vendor:'Lácteos Frescos del Pirineo', code_vendor:'PROV004', date_order:mAgo(2), date_reception:mAgo(2), total:175.20 },
  ]
  for (const p of pedidos) {
    db.prepare(`INSERT INTO pedidos_compra (user_id,num_order,vendor,code_vendor,date_order,date_reception,total) VALUES (?,?,?,?,?,?,?)`).run(uid,p.num_order,p.vendor,p.code_vendor,p.date_order,p.date_reception,p.total)
  }

  // ── ALBARANES COMPRA ──────────────────────────────────────
  const albaranes = [
    { delivery_num:'ALB-2026-0412', vendor:'Mercabarna Express SL', date_delivery:dAgo(1), base:283.30, taxes:59.49, total:342.80, received_by:'Pablo', cost_type:'Variable', vendor_type:'Frutas y Verduras' },
    { delivery_num:'ALB-2026-0411', vendor:'Pescados del Atlántico SA', date_delivery:dAgo(1), base:568.26, taxes:119.13, total:687.40, received_by:'Pablo', cost_type:'Variable', vendor_type:'Pescadería' },
    { delivery_num:'ALB-2026-0410', vendor:'Carnes Selectas Martínez', date_delivery:dAgo(2), base:433.55, taxes:91.05, total:524.60, received_by:'Chef', cost_type:'Variable', vendor_type:'Carnicería' },
    { delivery_num:'ALB-2026-0409', vendor:'Lácteos Frescos del Pirineo', date_delivery:dAgo(4), base:163.88, taxes:34.41, total:198.30, received_by:'Pablo', cost_type:'Variable', vendor_type:'Lácteos' },
    { delivery_num:'ALB-2026-0408', vendor:'Aceites García e Hijos', date_delivery:dAgo(5), base:341.32, taxes:71.68, total:413.00, received_by:'Pablo', cost_type:'Fijo', vendor_type:'Aceites' },
    { delivery_num:'ALB-2026-0407', vendor:'Mercabarna Express SL', date_delivery:dAgo(7), base:239.26, taxes:50.25, total:289.50, received_by:'Chef', cost_type:'Variable', vendor_type:'Frutas y Verduras' },
    { delivery_num:'ALB-2026-0406', vendor:'Harinera del Norte SL', date_delivery:dAgo(8), base:129.55, taxes:27.21, total:156.75, received_by:'Pablo', cost_type:'Fijo', vendor_type:'Harinas' },
    { delivery_num:'ALB-2026-0405', vendor:'Bodegas Rioja Premium', date_delivery:dAgo(9), base:737.19, taxes:154.81, total:892.00, received_by:'Pablo', cost_type:'Fijo', vendor_type:'Bebidas' },
    { delivery_num:'ALB-2026-0322', vendor:'Mercabarna Express SL', date_delivery:mAgo(1), base:263.14, taxes:55.26, total:318.40, received_by:'Pablo', cost_type:'Variable', vendor_type:'Frutas y Verduras' },
    { delivery_num:'ALB-2026-0321', vendor:'Carnes Selectas Martínez', date_delivery:mAgo(1), base:506.45, taxes:106.35, total:612.80, received_by:'Chef', cost_type:'Variable', vendor_type:'Carnicería' },
    { delivery_num:'ALB-2026-0320', vendor:'Pescados del Atlántico SA', date_delivery:mAgo(1), base:432.31, taxes:90.85, total:523.10, received_by:'Pablo', cost_type:'Variable', vendor_type:'Pescadería' },
  ]
  for (const a of albaranes) {
    db.prepare(`INSERT INTO albaranes_compra (user_id,delivery_num,vendor,date_delivery,base,taxes,total,received_by,cost_type,vendor_type) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(uid,a.delivery_num,a.vendor,a.date_delivery,a.base,a.taxes,a.total,a.received_by,a.cost_type,a.vendor_type)
  }

  // ── FACTURAS COMPRA ───────────────────────────────────────
  const facturas = [
    { invoice_num:'FAC-2026-0089', vendor:'Mercabarna Express SL', date_invoice:dAgo(7), date_due:dAgo(-7), base:522.56, taxes:109.74, total:632.30, paid:0, validated:1 },
    { invoice_num:'FAC-2026-0088', vendor:'Pescados del Atlántico SA', date_invoice:dAgo(10), date_due:dAgo(-5), base:993.45, taxes:208.62, total:1202.07, paid:0, validated:1 },
    { invoice_num:'FAC-2026-0087', vendor:'Carnes Selectas Martínez', date_invoice:dAgo(14), date_due:dAgo(1), base:866.45, taxes:181.95, total:1048.40, paid:0, validated:1 },
    { invoice_num:'FAC-2026-0086', vendor:'Bodegas Rioja Premium', date_invoice:dAgo(15), date_due:dAgo(15), base:737.19, taxes:154.81, total:892.00, paid:1, validated:1 },
    { invoice_num:'FAC-2026-0085', vendor:'Aceites García e Hijos', date_invoice:dAgo(20), date_due:dAgo(5), base:341.32, taxes:71.68, total:413.00, paid:0, validated:1 },
    { invoice_num:'FAC-2026-0084', vendor:'Lácteos Frescos del Pirineo', date_invoice:dAgo(25), date_due:dAgo(10), base:163.88, taxes:34.41, total:198.30, paid:1, validated:1 },
    { invoice_num:'FAC-2026-0083', vendor:'Harinera del Norte SL', date_invoice:mAgo(1), date_due:mAgo(1), base:129.55, taxes:27.21, total:156.75, paid:1, validated:1 },
    { invoice_num:'FAC-2026-0082', vendor:'Mercabarna Express SL', date_invoice:mAgo(1), date_due:dAgo(2), base:263.14, taxes:55.26, total:318.40, paid:0, validated:1 },
    { invoice_num:'FAC-2026-0081', vendor:'Distribuciones Roca Alimentación', date_invoice:mAgo(1), date_due:dAgo(3), base:560.66, taxes:117.74, total:678.40, paid:0, validated:0 },
  ]
  for (const f of facturas) {
    db.prepare(`INSERT INTO facturas_compra (user_id,invoice_num,vendor,date_invoice,date_due,base,taxes,total,paid,validated) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(uid,f.invoice_num,f.vendor,f.date_invoice,f.date_due,f.base,f.taxes,f.total,f.paid,f.validated)
  }

  // ── LISTA PEDIDOS ─────────────────────────────────────────
  const listaPedidos = [
    { descr:'Pedido semanal verduras', data:dAgo(1), year:2026, month:4, pending_send:0, pending_receive:0, locked:0, replicated:0 },
    { descr:'Pedido pescado lunes', data:dAgo(2), year:2026, month:4, pending_send:0, pending_receive:1, locked:0, replicated:0 },
    { descr:'Pedido carnes semana', data:dAgo(3), year:2026, month:4, pending_send:1, pending_receive:0, locked:0, replicated:0 },
    { descr:'Pedido lácteos quincenal', data:dAgo(5), year:2026, month:4, pending_send:1, pending_receive:1, locked:0, replicated:0 },
    { descr:'Pedido vinos mensual', data:dAgo(9), year:2026, month:4, pending_send:0, pending_receive:0, locked:1, replicated:1 },
    { descr:'Pedido especias trimestral', data:mAgo(1), year:2026, month:3, pending_send:0, pending_receive:0, locked:1, replicated:1 },
  ]
  for (const lp of listaPedidos) {
    db.prepare(`INSERT INTO lista_pedidos (user_id,descr,data,year,month,pending_send,pending_receive,locked,replicated) VALUES (?,?,?,?,?,?,?,?,?)`).run(uid,lp.descr,lp.data,lp.year,lp.month,lp.pending_send,lp.pending_receive,lp.locked,lp.replicated)
  }

  // ── ALBARANES VENTA ───────────────────────────────────────
  for (let i = 0; i < 12; i++) {
    db.prepare(`INSERT INTO albaranes_venta (user_id,invoice_num,customer,customer_type,date_delivery,base) VALUES (?,?,?,?,?,?)`)
      .run(uid,`AVE-2026-${String(i+1).padStart(3,'0')}`,['Hotel Arts Barcelona','Catering Premium SL','Eventos Corporativos BCN'][i%3],['Hotel','Catering','Eventos'][i%3],dAgo(i*2+1),800+i*150)
  }

  // ── PRECIO HISTORIAL ──────────────────────────────────────
  const histPrecios = [
    { nombre:'Aceite de oliva virgen extra', vendor:'Aceites García e Hijos', precio:4.20, unidad:'l', fecha:mAgo(3), fuente:'albaran' },
    { nombre:'Aceite de oliva virgen extra', vendor:'Aceites García e Hijos', precio:4.80, unidad:'l', fecha:mAgo(2), fuente:'albaran' },
    { nombre:'Aceite de oliva virgen extra', vendor:'Aceites García e Hijos', precio:5.60, unidad:'l', fecha:mAgo(1), fuente:'albaran' },
    { nombre:'Aceite de oliva virgen extra', vendor:'Aceites García e Hijos', precio:6.20, unidad:'l', fecha:dAgo(10), fuente:'albaran' },
    { nombre:'Salmón fresco', vendor:'Pescados del Atlántico SA', precio:11.80, unidad:'kg', fecha:mAgo(3), fuente:'albaran' },
    { nombre:'Salmón fresco', vendor:'Pescados del Atlántico SA', precio:13.20, unidad:'kg', fecha:mAgo(2), fuente:'albaran' },
    { nombre:'Salmón fresco', vendor:'Pescados del Atlántico SA', precio:14.50, unidad:'kg', fecha:mAgo(1), fuente:'albaran' },
    { nombre:'Salmón fresco', vendor:'Pescados del Atlántico SA', precio:15.20, unidad:'kg', fecha:dAgo(5), fuente:'albaran' },
    { nombre:'Nata líquida 35%', vendor:'Lácteos Frescos del Pirineo', precio:1.80, unidad:'l', fecha:mAgo(2), fuente:'albaran' },
    { nombre:'Nata líquida 35%', vendor:'Lácteos Frescos del Pirineo', precio:2.30, unidad:'l', fecha:dAgo(20), fuente:'albaran' },
    { nombre:'Pechuga de pollo', vendor:'Carnes Selectas Martínez', precio:7.20, unidad:'kg', fecha:mAgo(2), fuente:'albaran' },
    { nombre:'Pechuga de pollo', vendor:'Carnes Selectas Martínez', precio:6.20, unidad:'kg', fecha:dAgo(15), fuente:'albaran' },
    { nombre:'Gambas rojas', vendor:'Pescados del Atlántico SA', precio:24.00, unidad:'kg', fecha:mAgo(2), fuente:'albaran' },
    { nombre:'Gambas rojas', vendor:'Pescados del Atlántico SA', precio:28.50, unidad:'kg', fecha:dAgo(8), fuente:'albaran' },
    { nombre:'Harina de trigo T55', vendor:'Harinera del Norte SL', precio:0.72, unidad:'kg', fecha:mAgo(3), fuente:'albaran' },
    { nombre:'Harina de trigo T55', vendor:'Harinera del Norte SL', precio:0.87, unidad:'kg', fecha:mAgo(1), fuente:'albaran' },
  ]
  for (const p of histPrecios) {
    db.prepare(`INSERT INTO precio_historial (user_id,nombre,vendor,precio,unidad,fecha,fuente) VALUES (?,?,?,?,?,?,?)`).run(uid,p.nombre,p.vendor,p.precio,p.unidad,p.fecha,p.fuente)
  }

  // ── LINEAS ALBARAN (inconsistencias entre proveedores) ────
  const lineasAlb = [
    { vendor:'Mercabarna Express SL', nombre:'Tomate rama', cantidad:20, unidad:'kg', precio_unitario:1.80, total_linea:36.00, fecha:dAgo(7) },
    { vendor:'Distribuciones Roca Alimentación', nombre:'Tomate rama', cantidad:15, unidad:'kg', precio_unitario:2.40, total_linea:36.00, fecha:dAgo(3) },
    { vendor:'Aceites García e Hijos', nombre:'Aceite de oliva virgen extra', cantidad:30, unidad:'l', precio_unitario:6.20, total_linea:186.00, fecha:dAgo(10) },
    { vendor:'Distribuciones Roca Alimentación', nombre:'Aceite de oliva virgen extra', cantidad:10, unidad:'l', precio_unitario:4.90, total_linea:49.00, fecha:dAgo(12) },
    { vendor:'Pescados del Atlántico SA', nombre:'Salmón fresco', cantidad:15, unidad:'kg', precio_unitario:15.20, total_linea:228.00, fecha:dAgo(5) },
    { vendor:'Mercabarna Express SL', nombre:'Salmón fresco', cantidad:5, unidad:'kg', precio_unitario:12.50, total_linea:62.50, fecha:dAgo(7) },
    { vendor:'Carnes Selectas Martínez', nombre:'Pechuga de pollo', cantidad:25, unidad:'kg', precio_unitario:6.20, total_linea:155.00, fecha:dAgo(4) },
    { vendor:'Lácteos Frescos del Pirineo', nombre:'Nata líquida 35%', cantidad:20, unidad:'l', precio_unitario:2.30, total_linea:46.00, fecha:dAgo(6) },
    { vendor:'Harinera del Norte SL', nombre:'Harina de trigo T55', cantidad:50, unidad:'kg', precio_unitario:0.87, total_linea:43.50, fecha:dAgo(9) },
    { vendor:'Pescados del Atlántico SA', nombre:'Gambas rojas', cantidad:8, unidad:'kg', precio_unitario:28.50, total_linea:228.00, fecha:dAgo(5) },
    { vendor:'Mercabarna Express SL', nombre:'Espárrago verde', cantidad:5, unidad:'kg', precio_unitario:4.80, total_linea:24.00, fecha:dAgo(7) },
    { vendor:'Carnes Selectas Martínez', nombre:'Solomillo de ternera', cantidad:6, unidad:'kg', precio_unitario:32.00, total_linea:192.00, fecha:dAgo(4) },
  ]
  for (const l of lineasAlb) {
    db.prepare(`INSERT INTO lineas_albaran_compra (user_id,vendor,nombre,cantidad,unidad,precio_unitario,total_linea,fecha) VALUES (?,?,?,?,?,?,?,?)`).run(uid,l.vendor,l.nombre,l.cantidad,l.unidad,l.precio_unitario,l.total_linea,l.fecha)
  }

  // ── MERMA REGISTRO ────────────────────────────────────────
  const mermas = [
    { nombre:'Salmón fresco', cantidad:1.2, unidad:'kg', motivo:'caducidad', coste_estimado:18.24, fecha:dAgo(2), notas:'Llegó en mal estado del proveedor' },
    { nombre:'Tomate rama', cantidad:3.5, unidad:'kg', motivo:'caducidad', coste_estimado:6.30, fecha:dAgo(4), notas:'Sobrestock fin de semana largo' },
    { nombre:'Nata líquida 35%', cantidad:2, unidad:'l', motivo:'sobreproducción', coste_estimado:4.60, fecha:dAgo(5), notas:'Exceso mise en place servicio noche' },
    { nombre:'Pan brioche', cantidad:8, unidad:'ud', motivo:'caducidad', coste_estimado:9.60, fecha:dAgo(6), notas:'No se llegó a vender la tanda del domingo' },
    { nombre:'Costilla de cerdo', cantidad:0.8, unidad:'kg', motivo:'rotura', coste_estimado:4.64, fecha:dAgo(8), notas:'Caída en cámara frigorífica' },
    { nombre:'Pechuga de pollo', cantidad:0.5, unidad:'kg', motivo:'pérdida', coste_estimado:3.10, fecha:dAgo(10) },
    { nombre:'Aceite de oliva virgen extra', cantidad:0.5, unidad:'l', motivo:'rotura', coste_estimado:3.10, fecha:dAgo(12), notas:'Botella rota durante el servicio' },
    { nombre:'Gambas rojas', cantidad:0.4, unidad:'kg', motivo:'caducidad', coste_estimado:11.40, fecha:dAgo(3) },
    { nombre:'Merluza fresca', cantidad:0.6, unidad:'kg', motivo:'sobreproducción', coste_estimado:5.88, fecha:dAgo(1) },
    { nombre:'Fresas frescas', cantidad:0.8, unidad:'kg', motivo:'caducidad', coste_estimado:4.00, fecha:dAgo(1) },
    { nombre:'Espárrago verde', cantidad:0.3, unidad:'kg', motivo:'caducidad', coste_estimado:1.44, fecha:dAgo(2) },
    { nombre:'Huevos camperos L', cantidad:6, unidad:'ud', motivo:'rotura', coste_estimado:1.68, fecha:dAgo(7) },
    { nombre:'Bacalao desalado', cantidad:0.9, unidad:'kg', motivo:'pérdida', coste_estimado:10.44, fecha:mAgo(1), notas:'Descongelación involuntaria apagón' },
    { nombre:'Queso manchego curado', cantidad:0.4, unidad:'kg', motivo:'caducidad', coste_estimado:5.68, fecha:mAgo(1) },
    { nombre:'Foie gras mi-cuit', cantidad:0.1, unidad:'kg', motivo:'sobreproducción', coste_estimado:6.80, fecha:mAgo(1), notas:'No se vendió el menú degustación' },
    { nombre:'Caldo de pollo', cantidad:3, unidad:'l', motivo:'sobreproducción', coste_estimado:3.60, fecha:mAgo(1) },
  ]
  for (const m of mermas) {
    db.prepare(`INSERT INTO merma_registro (user_id,nombre,cantidad,unidad,motivo,coste_estimado,fecha,notas) VALUES (?,?,?,?,?,?,?,?)`).run(uid,m.nombre,m.cantidad,m.unidad,m.motivo,m.coste_estimado,m.fecha,m.notas||null)
  }

  // ── ESCANDALLO RECETAS ────────────────────────────────────
  const recetas = [
    { nombre:'Salmón a la plancha con verduras', categoria:'Segundos', raciones:1, precio_venta:22.00, merma_pct:8, lineas:[
      { nombre_libre:'Salmón fresco', cantidad:0.18, unidad:'kg', coste_unitario:15.20 },
      { nombre_libre:'Aceite de oliva virgen extra', cantidad:0.02, unidad:'l', coste_unitario:6.20 },
      { nombre_libre:'Espárrago verde', cantidad:0.06, unidad:'kg', coste_unitario:4.80 },
      { nombre_libre:'Tomate rama', cantidad:0.05, unidad:'kg', coste_unitario:1.80 },
    ]},
    { nombre:'Crema de tomate con albahaca', categoria:'Primeros', raciones:1, precio_venta:9.50, merma_pct:5, lineas:[
      { nombre_libre:'Tomate rama', cantidad:0.18, unidad:'kg', coste_unitario:1.80 },
      { nombre_libre:'Nata líquida 35%', cantidad:0.05, unidad:'l', coste_unitario:2.30 },
      { nombre_libre:'Cebolla blanca', cantidad:0.04, unidad:'kg', coste_unitario:0.60 },
      { nombre_libre:'Aceite de oliva virgen extra', cantidad:0.01, unidad:'l', coste_unitario:6.20 },
    ]},
    { nombre:'Pechuga de pollo mediterránea', categoria:'Segundos', raciones:1, precio_venta:16.50, merma_pct:6, lineas:[
      { nombre_libre:'Pechuga de pollo', cantidad:0.22, unidad:'kg', coste_unitario:6.20 },
      { nombre_libre:'Tomate rama', cantidad:0.08, unidad:'kg', coste_unitario:1.80 },
      { nombre_libre:'Aceite de oliva virgen extra', cantidad:0.02, unidad:'l', coste_unitario:6.20 },
      { nombre_libre:'Pimiento rojo', cantidad:0.05, unidad:'kg', coste_unitario:1.40 },
    ]},
    { nombre:'Arroz negro con gambas', categoria:'Arroces', raciones:1, precio_venta:24.00, merma_pct:10, lineas:[
      { nombre_libre:'Arroz bomba', cantidad:0.10, unidad:'kg', coste_unitario:2.10 },
      { nombre_libre:'Gambas rojas', cantidad:0.12, unidad:'kg', coste_unitario:28.50 },
      { nombre_libre:'Caldo de pollo', cantidad:0.25, unidad:'l', coste_unitario:1.20 },
      { nombre_libre:'Aceite de oliva virgen extra', cantidad:0.02, unidad:'l', coste_unitario:6.20 },
    ]},
    { nombre:'Solomillo al foie', categoria:'Segundos', raciones:1, precio_venta:38.00, merma_pct:8, lineas:[
      { nombre_libre:'Solomillo de ternera', cantidad:0.22, unidad:'kg', coste_unitario:32.00 },
      { nombre_libre:'Foie gras mi-cuit', cantidad:0.04, unidad:'kg', coste_unitario:68.00 },
      { nombre_libre:'Mantequilla sin sal', cantidad:0.02, unidad:'kg', coste_unitario:8.40 },
      { nombre_libre:'Trufa negra rallada', cantidad:2, unidad:'g', coste_unitario:0.85 },
    ]},
    { nombre:'Tarta de nata y fresas', categoria:'Postres', raciones:1, precio_venta:7.50, merma_pct:10, lineas:[
      { nombre_libre:'Nata líquida 35%', cantidad:0.12, unidad:'l', coste_unitario:2.30 },
      { nombre_libre:'Harina de trigo T55', cantidad:0.06, unidad:'kg', coste_unitario:0.87 },
      { nombre_libre:'Fresas frescas', cantidad:0.06, unidad:'kg', coste_unitario:5.00 },
      { nombre_libre:'Azúcar blanco', cantidad:0.04, unidad:'kg', coste_unitario:0.95 },
    ]},
  ]
  const recetaIds: Record<string, number> = {}
  for (const r of recetas) {
    const res = db.prepare(`INSERT INTO escandallo_receta (user_id,nombre,categoria,raciones,precio_venta,merma_pct,activo) VALUES (?,?,?,?,?,?,1)`).run(uid,r.nombre,r.categoria,r.raciones,r.precio_venta,r.merma_pct)
    recetaIds[r.nombre] = res.lastInsertRowid as number
    for (const l of r.lineas) {
      db.prepare(`INSERT INTO escandallo_lineas (receta_id,user_id,nombre_libre,cantidad,unidad,coste_unitario) VALUES (?,?,?,?,?,?)`).run(recetaIds[r.nombre],uid,l.nombre_libre,l.cantidad,l.unidad,l.coste_unitario)
    }
  }

  // ── PRODUCCIÓN (consumo teórico) ──────────────────────────
  const produccion = [
    { nombre:'Salmón a la plancha con verduras', raciones:34, fecha:dAgo(1) },
    { nombre:'Salmón a la plancha con verduras', raciones:28, fecha:dAgo(2) },
    { nombre:'Crema de tomate con albahaca', raciones:52, fecha:dAgo(1) },
    { nombre:'Crema de tomate con albahaca', raciones:41, fecha:dAgo(2) },
    { nombre:'Pechuga de pollo mediterránea', raciones:29, fecha:dAgo(1) },
    { nombre:'Pechuga de pollo mediterránea', raciones:22, fecha:dAgo(2) },
    { nombre:'Arroz negro con gambas', raciones:18, fecha:dAgo(1) },
    { nombre:'Arroz negro con gambas', raciones:15, fecha:dAgo(2) },
    { nombre:'Solomillo al foie', raciones:12, fecha:dAgo(1) },
    { nombre:'Tarta de nata y fresas', raciones:24, fecha:dAgo(1) },
    { nombre:'Tarta de nata y fresas', raciones:20, fecha:dAgo(2) },
  ]
  for (const p of produccion) {
    const rid = recetaIds[p.nombre] ?? null
    db.prepare(`INSERT INTO ventas_produccion (user_id,receta_id,nombre,raciones,fecha) VALUES (?,?,?,?,?)`).run(uid,rid,p.nombre,p.raciones,p.fecha)
  }

  const counts: Record<string, number> = {}
  for (const t of ['ingredientes','proveedores','pedidos_compra','albaranes_compra','facturas_compra','precio_historial','merma_registro','escandallo_receta','ventas_produccion']) {
    counts[t] = (db.prepare(`SELECT COUNT(*) as c FROM ${t} WHERE user_id=?`).get(uid) as any).c
  }

  return NextResponse.json({ ok: true, counts })
}
