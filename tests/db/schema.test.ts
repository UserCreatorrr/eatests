// La base de datos impide el error, no la pantalla. Cada regla del esquema
// tiene aquí su prueba: si alguien la relaja, este test lo dice.
import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DB } from '@/server/db/connection'

let db: DB

const fails = (sql: string, code?: string) => {
  let err: any = null
  try { db.exec(sql) } catch (e) { err = e }
  expect(err, `la BD aceptó: ${sql}`).not.toBeNull()
  if (code) expect(err.message).toContain(code)
}

beforeEach(() => {
  db = openDatabase(':memory:')
  db.exec(`
    INSERT INTO organizations (id, name) VALUES (1, 'A'), (2, 'B');
    INSERT INTO suppliers (id, org_id, name, tax_id) VALUES (1, 1, 'Makro', 'A28647451');
    INSERT INTO ingredients (id, org_id, name, base_unit, cost) VALUES (10, 1, 'Tomate', 'kg', 2.1), (20, 2, 'Ajeno', 'kg', 1);
    INSERT INTO recipes (id, org_id, name) VALUES (100, 1, 'Plato');
  `)
})

describe('migraciones', () => {
  it('aplica el esquema y queda sin claves rotas', () => {
    const m = db.prepare('SELECT id, name FROM schema_migrations').all()
    expect(m).toEqual([{ id: 1, name: 'initial' }])
    expect(db.pragma('foreign_key_check')).toEqual([])
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
  })
})

describe('aislamiento entre organizaciones', () => {
  it('una receta no puede usar el ingrediente de otra organización', () => {
    fails(`INSERT INTO recipe_lines (org_id, recipe_id, ingredient_id, qty, unit) VALUES (1, 100, 20, 1, 'kg')`, 'FOREIGN KEY')
  })
})

describe('escandallo', () => {
  it('una línea es exactamente ingrediente, subreceta o libre', () => {
    fails(`INSERT INTO recipe_lines (org_id, recipe_id, qty, unit) VALUES (1, 100, 1, 'kg')`, 'CHECK')
    fails(`INSERT INTO recipe_lines (org_id, recipe_id, ingredient_id, free_name, qty, unit) VALUES (1, 100, 10, 'x', 1, 'kg')`, 'CHECK')
    fails(`INSERT INTO recipe_lines (org_id, recipe_id, sub_recipe_id, qty, unit) VALUES (1, 100, 100, 1, 'kg')`, 'CHECK')
  })
  it('solo admite unidades del catálogo', () => {
    fails(`INSERT INTO ingredients (org_id, name, base_unit) VALUES (1, 'X', 'Tarro')`, 'CHECK')
    fails(`INSERT INTO recipe_lines (org_id, recipe_id, ingredient_id, qty, unit) VALUES (1, 100, 10, 1, 'Kg')`, 'CHECK')
  })
})

describe('proveedores y documentos', () => {
  it('no admite dos proveedores con el mismo NIF ni el mismo nombre', () => {
    fails(`INSERT INTO suppliers (org_id, name, tax_id) VALUES (1, 'Makro SA', 'A28647451')`, 'UNIQUE')
    fails(`INSERT INTO suppliers (org_id, name) VALUES (1, 'makro')`, 'UNIQUE')
  })
  it('rechaza fechas fuera del formato ISO', () => {
    fails(`INSERT INTO delivery_notes (org_id, supplier_id, number, delivery_date) VALUES (1, 1, 'A', '13/08/2026')`, 'CHECK')
  })
  it('un albarán no se valida sin líneas y, validado, queda bloqueado', () => {
    db.exec(`INSERT INTO delivery_notes (id, org_id, supplier_id, number, delivery_date) VALUES (5, 1, 1, 'ALB-1', '2026-08-13')`)
    fails(`UPDATE delivery_notes SET status = 'validated' WHERE id = 5`, 'DELIVERY_NOTE_WITHOUT_LINES')
    db.exec(`INSERT INTO delivery_note_lines (org_id, delivery_note_id, description, qty, unit, unit_price) VALUES (1, 5, 'Tomate', 10, 'kg', 2);
             UPDATE delivery_notes SET status = 'validated' WHERE id = 5`)
    fails(`DELETE FROM delivery_note_lines WHERE delivery_note_id = 5`, 'DELIVERY_NOTE_LOCKED')
    fails(`INSERT INTO delivery_note_lines (org_id, delivery_note_id, description, qty, unit) VALUES (1, 5, 'Más', 1, 'kg')`, 'DELIVERY_NOTE_LOCKED')
  })
  it('no admite dos albaranes con el mismo número del mismo proveedor', () => {
    db.exec(`INSERT INTO delivery_notes (org_id, supplier_id, number, delivery_date) VALUES (1, 1, 'ALB-1', '2026-08-13')`)
    fails(`INSERT INTO delivery_notes (org_id, supplier_id, number, delivery_date) VALUES (1, 1, 'ALB-1', '2026-08-14')`, 'UNIQUE')
  })
  it('facturado equivale a tener factura', () => {
    db.exec(`INSERT INTO delivery_notes (id, org_id, supplier_id, number, delivery_date) VALUES (6, 1, 1, 'ALB-2', '2026-08-13')`)
    fails(`UPDATE delivery_notes SET status = 'invoiced' WHERE id = 6`, 'CHECK')
  })
})

describe('stock', () => {
  it('el libro mayor es de solo inserción', () => {
    db.exec(`INSERT INTO stock_movements (org_id, ingredient_id, qty, kind, occurred_at) VALUES (1, 10, 5, 'receipt', '2026-08-13')`)
    fails(`UPDATE stock_movements SET qty = 99`, 'APPEND_ONLY')
    fails(`DELETE FROM stock_movements`, 'APPEND_ONLY')
    fails(`INSERT INTO stock_movements (org_id, ingredient_id, qty, kind, occurred_at) VALUES (1, 10, 0, 'receipt', '2026-08-13')`, 'CHECK')
  })
})
