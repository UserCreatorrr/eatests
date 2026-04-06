import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import path from 'path'

const DB_PATH =
  process.env.DB_PATH ||
  (process.env.NODE_ENV === 'production' ? '/data/marginbites.db' : './marginbites.db')

declare global {
  // eslint-disable-next-line no-var
  var _db: Database.Database | undefined
}

function initSchema(db: Database.Database) {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name        TEXT,
      google_id   TEXT UNIQUE,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ingredientes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id),
      codi       TEXT,
      descr      TEXT,
      type       TEXT,
      has_data   INTEGER,
      unit       TEXT,
      id_unit    INTEGER,
      cost       REAL,
      color      TEXT
    );

    CREATE TABLE IF NOT EXISTS herramientas (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id),
      codi       TEXT,
      descr      TEXT,
      type       TEXT,
      has_data   INTEGER,
      unit       TEXT,
      id_unit    INTEGER,
      cost       REAL
    );

    CREATE TABLE IF NOT EXISTS proveedores (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id),
      codi       TEXT,
      descr      TEXT,
      descr_type TEXT,
      id_type    INTEGER,
      defecte    INTEGER,
      has_other  INTEGER
    );

    CREATE TABLE IF NOT EXISTS proveedores_detalle (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id),
      codi       TEXT,
      descr      TEXT,
      nif        TEXT,
      comment    TEXT,
      mail_cc    TEXT,
      web        TEXT,
      creditor   TEXT,
      address    TEXT,
      city       TEXT,
      cp         TEXT
    );

    CREATE TABLE IF NOT EXISTS lista_pedidos (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        TEXT NOT NULL REFERENCES users(id),
      descr          TEXT,
      data           TEXT,
      year           INTEGER,
      month          INTEGER,
      pending_send   INTEGER,
      pending_receive INTEGER
    );

    CREATE TABLE IF NOT EXISTS pedidos_compra (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        TEXT NOT NULL REFERENCES users(id),
      num_order      TEXT,
      vendor         TEXT,
      code_vendor    TEXT,
      nif            TEXT,
      date_order     TEXT,
      date_reception TEXT,
      sent_by        TEXT,
      total          REAL
    );

    CREATE TABLE IF NOT EXISTS albaranes_compra (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        TEXT NOT NULL REFERENCES users(id),
      delivery_num   TEXT,
      vendor         TEXT,
      code_vendor    TEXT,
      nif            TEXT,
      delivery_for   TEXT,
      date_delivery  TEXT,
      date_sent      TEXT,
      sent_by        TEXT,
      received_by    TEXT,
      base           REAL,
      taxes          REAL,
      total          REAL,
      cost_type      TEXT,
      vendor_type    TEXT
    );

    CREATE TABLE IF NOT EXISTS albaranes_venta (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        TEXT NOT NULL REFERENCES users(id),
      invoice_num    TEXT,
      customer       TEXT,
      customer_code  TEXT,
      customer_type  TEXT,
      nif            TEXT,
      contact        TEXT,
      phone          TEXT,
      mail           TEXT,
      address        TEXT,
      cp             TEXT,
      city           TEXT,
      date_delivery  TEXT,
      base           REAL
    );

    CREATE TABLE IF NOT EXISTS facturas_compra (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           TEXT NOT NULL REFERENCES users(id),
      invoice_num       TEXT,
      document_num      TEXT,
      vendor            TEXT,
      code_vendor       TEXT,
      nif               TEXT,
      account_vendor    TEXT,
      date_invoice      TEXT,
      date_accounting   TEXT,
      date_due          TEXT,
      code_payment_type TEXT,
      base              REAL,
      taxes             REAL,
      total             REAL,
      paid              INTEGER,
      validated         INTEGER,
      comment           TEXT
    );

    CREATE TABLE IF NOT EXISTS facturas_venta (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           TEXT NOT NULL REFERENCES users(id),
      invoice_num       TEXT,
      document_num      TEXT,
      customer          TEXT,
      code_customer     TEXT,
      nif               TEXT,
      account_customer  TEXT,
      date_invoice      TEXT,
      date_accounting   TEXT,
      date_due          TEXT,
      code_payment_type TEXT,
      base              REAL,
      taxes             REAL,
      total             REAL,
      paid              INTEGER,
      comment           TEXT
    );

    CREATE TABLE IF NOT EXISTS escandallo_receta (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      TEXT NOT NULL REFERENCES users(id),
      nombre       TEXT,
      categoria    TEXT,
      descripcion  TEXT,
      raciones     INTEGER,
      precio_venta REAL,
      ingredientes TEXT,
      merma_pct    REAL,
      notas        TEXT,
      activo       INTEGER DEFAULT 1
    );
  `)

  // Seed hardcoded admin user
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('pabloperez@visualandgrowth.es')
  if (!existing) {
    const hash = bcrypt.hashSync('Marginbites2026+', 10)
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name)
      VALUES ('pablo-admin', 'pabloperez@visualandgrowth.es', ?, 'Pablo Perez')
    `).run(hash)
  }
}

function getDb(): Database.Database {
  if (!global._db) {
    global._db = new Database(DB_PATH)
    initSchema(global._db)
  }
  return global._db
}

export default getDb()

export type User = {
  id: string
  email: string
  name: string | null
  google_id: string | null
  created_at: string
}
