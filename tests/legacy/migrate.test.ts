// La migración se prueba contra una BD v1 sintética que reproduce los casos
// sucios encontrados en producción: "Kg" y "Tarro", proveedores duplicados
// por NIF, albarán validado sin líneas, fechas en dos formatos, líneas de
// albarán sin documento, recetas con nombre repetido, subreceta.
import Database from 'better-sqlite3'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateV1 } from '@/server/legacy/migrate-v1'
import { openDatabase } from '@/server/db/connection'

let dir: string, v1: string, v2: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-mig-'))
  v1 = path.join(dir, 'v1.db'); v2 = path.join(dir, 'v2.db')
  const db = new Database(v1)
  db.exec(fs.readFileSync(path.join(__dirname, 'v1-schema.sql'), 'utf8'))
  db.exec(`
    INSERT INTO users (id, email, password_hash, name, created_at) VALUES ('u1', 'A@Test.com', 'hash', 'Ana', '2026-04-12 00:04:41'), ('u2', 'b@test.com', NULL, NULL, '2026-05-01 10:00:00');
    INSERT INTO proveedores (id, user_id, descr, nif, mail) VALUES (1, 'u1', 'Makro', 'A-28/647451', 'm@makro.es'), (2, 'u1', 'Makro Distribucion Mayorista, S.A.', 'A28647451', NULL), (3, 'u1', 'Servifruta', 'B-45671633', NULL);
    INSERT INTO proveedores_detalle (user_id, descr, nif, city) VALUES ('u1', 'Makro', 'A28647451', 'Madrid');
    INSERT INTO ingredientes (id, user_id, descr, type, unit, cost, proveedor_id, proveedor_nombre, almacen_principal, iva) VALUES
      (10, 'u1', 'Pechuga de pollo', 'Carnes', 'kg', 6.2, 1, 'Makro', 'Nevera', 10),
      (11, 'u1', 'Romero fresco', 'Hierba', 'Kg', 20, 3, 'Servifruta', NULL, NULL),
      (12, 'u1', 'Mostaza', 'Ingrediente', 'Tarro', 1.65, NULL, NULL, 'Almacén seco', 21),
      (13, 'u1', 'Fresón', NULL, 'kg', 3, NULL, NULL, NULL, NULL),
      (14, 'u1', 'fresón', NULL, 'kg', 3.5, NULL, NULL, NULL, NULL),
      (20, 'u2', 'Ajeno', NULL, 'kg', 1, NULL, NULL, NULL, NULL);
    INSERT INTO escandallo_receta (id, user_id, nombre, raciones, precio_venta, es_subreceta, cantidad_producida, unidad_producida, source, activo) VALUES
      (100, 'u1', 'Marinada', 1, NULL, 1, 120, 'g', NULL, 1),
      (101, 'u1', 'Pollo al limón', 10, 6.5, 0, NULL, NULL, 'excel', 1),
      (102, 'u1', 'Pollo al limón', 4, 20, 0, NULL, NULL, NULL, 1);
    INSERT INTO escandallo_lineas (id, receta_id, user_id, ingrediente_id, subreceta_id, nombre_libre, cantidad, unidad, coste_unitario, merma_pct, cantidad_neta) VALUES
      (1, 100, 'u1', 11, NULL, NULL, 14, 'g', NULL, 15, 14),
      (2, 101, 'u1', 10, NULL, NULL, 2000, 'g', NULL, NULL, NULL),
      (3, 101, 'u1', NULL, 100, NULL, 30, 'g', NULL, NULL, NULL),
      (4, 101, 'u1', 12, NULL, NULL, 0.005, 'Tarro', 1.65, NULL, NULL),
      (5, 101, 'u1', NULL, NULL, 'Sal', 5, 'g', 0.5, NULL, NULL),
      (6, 999, 'u1', 10, NULL, NULL, 1, 'kg', NULL, NULL, NULL),
      (7, 102, 'u1', NULL, NULL, 'Patata', 1, 'Kg', 1, NULL, NULL);
    INSERT INTO albaranes_compra (id, user_id, delivery_num, vendor, nif, date_delivery, base, taxes, total, estado, source) VALUES
      (50, 'u1', 'ALB-1', 'Makro', 'A28647451', '2026-08-15', 31, 3.1, 34.1, 'validado', 'scanny'),
      (51, 'u1', 'ALB-1', 'Makro Distribucion Mayorista, S.A.', 'A28647451', '15/08/2026', 31, NULL, 31, NULL, NULL),
      (52, 'u1', 'ALB-2', 'Makro', NULL, '2026-08-16', 42.5, NULL, NULL, 'validado', 'scanny');
    INSERT INTO lineas_albaran_compra (id, user_id, albaran_id, doc_tipo, doc_id, vendor, nombre, cantidad, unidad, precio_unitario, total_linea, fecha, ingrediente_id, iva_pct) VALUES
      (1, 'u1', NULL, 'albaran', 52, 'Makro', 'Pechuga', 5, 'kg', 8.5, 42.5, '2026-08-16', 10, 10),
      (2, 'u1', NULL, NULL, NULL, 'Servifruta', 'Romero fresco', 0.5, 'kg', 20, 10, '2026-04-21', NULL, NULL),
      (3, 'u1', NULL, NULL, NULL, 'Servifruta', 'Fresón', 2, 'kg', 3, 6, '2026-04-21', NULL, NULL);
    INSERT INTO facturas_compra (id, user_id, invoice_num, vendor, nif, date_invoice, date_due, base, taxes, total, paid, validated) VALUES
      (70, 'u1', 'F-1', 'Makro', 'A28647451', '13/08/2026', '2026-08-01', 100, 21, 121, 1, 1);
    INSERT INTO pedidos_compra (id, user_id, num_order, vendor, date_order, date_reception, sent_by, total) VALUES (80, 'u1', 'PED-1', 'Makro', '2026-08-14', NULL, 'whatsapp', 31);
    INSERT INTO pedidos_compra_lineas (user_id, pedido_id, ingrediente_id, nombre, cantidad, unidad, coste_estimado) VALUES ('u1', 80, 10, 'Pechuga', 5, 'kg', 31);
    INSERT INTO precio_historial (user_id, nombre, vendor, precio, unidad, fecha, fuente, ingrediente_id, precio_anterior, doc_tipo, doc_id) VALUES ('u1', 'Pechuga de pollo', 'Makro', 8.5, 'kg', '2026-08-16', 'albaran', 10, 6.2, 'albaran', 52);
    INSERT INTO merma_registro (user_id, nombre, ingrediente_id, cantidad, unidad, motivo, coste_estimado, fecha, tipo) VALUES ('u1', 'Pechuga de pollo', 10, 0.5, 'kg', 'caducado', 4.25, '2026-08-17', 'ingrediente');
    INSERT INTO locations (user_id, site_id, nombre, ciudad, activo) VALUES ('u1', 'MAD', 'Madrid', 'Madrid', 1);
    INSERT INTO empleados (id, user_id, employee_id, nombre, site_id, coste_hora) VALUES (1, 'u1', 'E-1', 'Lucía', 'MAD', 12);
    INSERT INTO turnos (user_id, site_id, employee_id, employee_name, fecha, start_time, end_time, break_minutes, horas_plan, overnight) VALUES
      ('u1', 'MAD', 1, 'Lucía', '2026-09-01', '09:00', '16:30', 30, 7, 0), ('u1', 'MAD', 1, 'Lucía', '2026-09-01', '09:00', '16:30', 30, 7, 0), ('u1', 'BCN', NULL, 'Nadie', '2026-09-01', '9:00', '14:00', 0, 5, 0);
    INSERT INTO ventas_franja (user_id, site_id, fecha, timeslot_start, timeslot_end, channel, sales_net) VALUES ('u1', 'MAD', '2026-09-01', '13:00', '14:00', 'Sala', 450.5);
    INSERT INTO notifications (user_id, type, title, urgency, read) VALUES ('u1', 'precio', 'Sube la pechuga', 'alta', 0);
    INSERT INTO app_settings (key, value) VALUES ('fix_merma_neta', '1'), ('gmail_tokens', '{"x":1}');
  `)
  db.close()
})
afterEach(() => { try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* Windows: handle abierto, el SO lo limpia */ } })

describe('migración v1 → v2', () => {
  it('crea una organización por usuario y conserva todo lo que se puede', () => {
    const report = migrateV1(v1, v2)
    expect(report.users).toBe(2)
    expect(report.orgs).toBe(2)
    const db = openDatabase(v2)
    const org = (db.prepare(`SELECT m.org_id FROM memberships m JOIN users u ON u.id = m.user_id WHERE u.email = 'a@test.com'`).get() as any).org_id
    // Proveedores: los dos "Makro" (mismo NIF) son uno; el detalle aporta la ciudad
    const sup = db.prepare('SELECT name, tax_id, city, email FROM suppliers WHERE org_id = ? ORDER BY id').all(org)
    expect(sup).toEqual([{ name: 'Makro', tax_id: 'A28647451', city: 'Madrid', email: 'm@makro.es' }, { name: 'Servifruta', tax_id: 'B45671633', city: null, email: null }])
    // Ingredientes: Kg → kg, Tarro → ud anotado, fresón duplicado fusionado
    const ing = db.prepare('SELECT name, base_unit, cost, category FROM ingredients WHERE org_id = ? ORDER BY id').all(org) as any[]
    expect(ing.map(i => [i.name, i.base_unit])).toEqual([['Pechuga de pollo', 'kg'], ['Romero fresco', 'kg'], ['Mostaza', 'ud'], ['Fresón', 'kg']])
    expect(ing[2].category).toBeNull()   // "Ingrediente" genérico no es categoría
    expect(report.issues.some(i => i.issue.includes('"Tarro"'))).toBe(true)
    expect(report.issues.some(i => i.issue.includes('duplicado') && i.table === 'ingredientes')).toBe(true)
    // Recetas: la elaboración con producción, el nombre repetido renombrado, la línea huérfana descartada
    const rec = db.prepare('SELECT name, kind, yield_qty, yield_unit, source FROM recipes WHERE org_id = ? ORDER BY id').all(org)
    expect(rec).toEqual([
      { name: 'Marinada', kind: 'preparation', yield_qty: 120, yield_unit: 'g', source: 'legacy' },
      { name: 'Pollo al limón', kind: 'dish', yield_qty: null, yield_unit: null, source: 'excel' },
      { name: 'Pollo al limón (102)', kind: 'dish', yield_qty: null, yield_unit: null, source: 'legacy' },
    ])
    const lines = db.prepare(`SELECT l.ingredient_id IS NOT NULL AS ing, l.sub_recipe_id IS NOT NULL AS sub, l.free_name, l.qty, l.unit, l.waste_pct FROM recipe_lines l JOIN recipes r ON r.id = l.recipe_id WHERE r.org_id = ? ORDER BY l.id`).all(org)
    expect(lines).toEqual([
      { ing: 1, sub: 0, free_name: null, qty: 14, unit: 'g', waste_pct: 15 },
      { ing: 1, sub: 0, free_name: null, qty: 2000, unit: 'g', waste_pct: 0 },
      { ing: 0, sub: 1, free_name: null, qty: 30, unit: 'g', waste_pct: 0 },
      { ing: 1, sub: 0, free_name: null, qty: 0.005, unit: 'ud', waste_pct: 0 },
      { ing: 0, sub: 0, free_name: 'Sal', qty: 5, unit: 'g', waste_pct: 0 },
      { ing: 0, sub: 0, free_name: 'Patata', qty: 1, unit: 'kg', waste_pct: 0 },
    ])
    expect(report.issues.find(i => i.table === 'escandallo_lineas' && i.legacyId === 6)?.action).toBe('descartada')
    db.close()
  })

  it('documentos: duplicados en revisión, validado sin líneas a revisión, fechas normalizadas, stock del validado', () => {
    const report = migrateV1(v1, v2)
    const db = openDatabase(v2)
    const dn = db.prepare(`SELECT number, delivery_date, status, base_cents, (SELECT COUNT(*) FROM delivery_note_lines WHERE delivery_note_id = d.id) AS n FROM delivery_notes d ORDER BY id`).all() as any[]
    expect(dn.map(d => [d.number, d.delivery_date, d.status, d.n])).toEqual([
      ['ALB-1', '2026-08-15', 'review', 0],              // "validado" sin líneas → revisión
      ['ALB-1 (dup 51)', '2026-08-15', 'review', 0],     // duplicado conservado en revisión
      ['ALB-2', '2026-08-16', 'validated', 1],
      ['ALB-LEGACY-20260421-2', '2026-04-21', 'draft', 2], // líneas sueltas agrupadas por proveedor+fecha
    ])
    expect(dn[2].base_cents).toBe(4250)
    // El albarán validado generó entrada de stock en la unidad base
    expect(db.prepare('SELECT qty, unit_cost, kind FROM stock_movements').all()).toEqual([{ qty: 5, unit_cost: 8.5, kind: 'receipt' }])
    // La factura: fecha normalizada, vencimiento incoherente eliminado y anotado, pagada
    expect(db.prepare('SELECT number, invoice_date, due_date, status, total_cents FROM invoices').all()).toEqual([{ number: 'F-1', invoice_date: '2026-08-13', due_date: null, status: 'paid', total_cents: 12100 }])
    expect(report.issues.some(i => i.table === 'facturas_compra' && i.issue.includes('vencimiento'))).toBe(true)
    // El pedido enviado por whatsapp
    expect(db.prepare('SELECT number, status, sent_via, (SELECT COUNT(*) FROM purchase_order_lines) AS n FROM purchase_orders').get()).toEqual({ number: 'PED-1', status: 'sent', sent_via: 'whatsapp', n: 1 })
    // Precio, merma, labor
    expect(db.prepare('SELECT unit_price, previous_price, source_type FROM price_observations WHERE source_type <> ?').all('legacy')).toEqual([{ unit_price: 8.5, previous_price: 6.2, source_type: 'delivery_note' }])
    expect(db.prepare('SELECT qty, unit, estimated_cost, occurred_on FROM waste_records').get()).toEqual({ qty: 0.5, unit: 'kg', estimated_cost: 4.25, occurred_on: '2026-08-17' })
    expect(db.prepare('SELECT COUNT(*) AS n FROM shifts').get()).toEqual({ n: 2 })   // el turno repetido se descarta
    expect(db.prepare('SELECT code FROM locations ORDER BY id').all()).toEqual([{ code: 'MAD' }, { code: 'BCN' }])   // BCN creado desde turnos
    expect(db.prepare('SELECT start_time FROM shifts WHERE employee_name = ?').get('Nadie')).toEqual({ start_time: '09:00' })
    expect(db.prepare('SELECT urgency, read_at FROM notifications').get()).toEqual({ urgency: 'high', read_at: null })
    expect(db.prepare('SELECT key FROM app_settings ORDER BY key').all()).toEqual([{ key: 'gmail_tokens' }])
    expect(db.pragma('foreign_key_check')).toEqual([])
    db.close()
  })

  it('es determinista y se niega a escribir sobre una BD con datos', () => {
    const a = migrateV1(v1, v2)
    const v2b = path.join(dir, 'v2b.db')
    const b = migrateV1(v1, v2b)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(() => migrateV1(v1, v2)).toThrow(/no está vacía/)
  })
})
