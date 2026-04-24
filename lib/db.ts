import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import path from 'path'
import fs from 'fs'
import { seedDemoData } from './seedData'

const DB_PATH =
  process.env.DB_PATH ||
  (process.env.NODE_ENV === 'production' ? '/data/marginbites.db' : './marginbites.db')

fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true })

declare global {
  // eslint-disable-next-line no-var
  var _db: Database.Database | undefined
}

// NEVER lower this value — it would wipe all data on next deploy
const SCHEMA_VERSION = 4

function initSchema(db: Database.Database) {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name          TEXT,
      google_id     TEXT UNIQUE,
      avatar        TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER NOT NULL);
  `)

  const row = db.prepare('SELECT version FROM _schema_version LIMIT 1').get() as { version: number } | undefined
  if (!row) {
    // First time ever — just mark version, tables created below with IF NOT EXISTS
    db.exec(`INSERT INTO _schema_version (version) VALUES (${SCHEMA_VERSION});`)
  } else if (row.version < SCHEMA_VERSION) {
    // Safe migration: only update version, never drop tables
    db.exec(`UPDATE _schema_version SET version = ${SCHEMA_VERSION};`)
  }

  // Column names match EXACTLY what node "12. Preparar Payload" sends to /api/ingest
  db.exec(`
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
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL REFERENCES users(id),
      codi        TEXT,
      descr       TEXT,
      defecte     INTEGER,
      descr_type  TEXT,
      id_type     TEXT,
      has_other   INTEGER,
      nif         TEXT,
      alt_descr   TEXT,
      comment     TEXT,
      address     TEXT,
      city        TEXT,
      cp          TEXT,
      contact     TEXT,
      phone       TEXT,
      mail        TEXT,
      contact_aux TEXT,
      phone_aux   TEXT,
      mail_aux    TEXT,
      mailcc      TEXT,
      web         TEXT,
      locked      INTEGER,
      replicated  INTEGER
    );

    CREATE TABLE IF NOT EXISTS proveedores_detalle (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL REFERENCES users(id),
      codi        TEXT,
      descr       TEXT,
      nif         TEXT,
      comment     TEXT,
      mail_cc     TEXT,
      web         TEXT,
      creditor    INTEGER,
      address     TEXT,
      city        TEXT,
      cp          TEXT
    );

    CREATE TABLE IF NOT EXISTS lista_pedidos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL REFERENCES users(id),
      descr           TEXT,
      data            TEXT,
      defecte         INTEGER,
      year            INTEGER,
      month           INTEGER,
      pending_send    INTEGER,
      pending_receive INTEGER,
      locked          INTEGER,
      replicated      INTEGER
    );

    CREATE TABLE IF NOT EXISTS pedidos_compra (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL REFERENCES users(id),
      num_order       TEXT,
      vendor          TEXT,
      code_vendor     TEXT,
      nif             TEXT,
      date_order      TEXT,
      date_reception  TEXT,
      sent_by         TEXT,
      total           REAL
    );

    CREATE TABLE IF NOT EXISTS albaranes_compra (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL REFERENCES users(id),
      delivery_num    TEXT,
      vendor          TEXT,
      code_vendor     TEXT,
      nif             TEXT,
      delivery_for    TEXT,
      date_delivery   TEXT,
      date_sent       TEXT,
      sent_by         TEXT,
      received_by     TEXT,
      base            REAL,
      taxes           REAL,
      total           REAL,
      cost_type       TEXT,
      vendor_type     TEXT
    );

    CREATE TABLE IF NOT EXISTS albaranes_venta (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL REFERENCES users(id),
      invoice_num     TEXT,
      customer        TEXT,
      customer_code   TEXT,
      customer_type   TEXT,
      nif             TEXT,
      contact         TEXT,
      phone           TEXT,
      mail            TEXT,
      address         TEXT,
      cp              TEXT,
      city            TEXT,
      date_delivery   TEXT,
      base            REAL
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

    CREATE TABLE IF NOT EXISTS escandallo_lineas (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      receta_id       INTEGER NOT NULL,
      user_id         TEXT NOT NULL REFERENCES users(id),
      ingrediente_id  INTEGER,
      nombre_libre    TEXT,
      cantidad        REAL NOT NULL DEFAULT 0,
      unidad          TEXT,
      coste_unitario  REAL,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id),
      endpoint   TEXT NOT NULL UNIQUE,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id),
      type       TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT,
      urgency    TEXT DEFAULT 'media',
      link       TEXT,
      read       INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS precio_historial (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id),
      nombre     TEXT NOT NULL,
      vendor     TEXT,
      precio     REAL NOT NULL,
      unidad     TEXT,
      fecha      TEXT DEFAULT (date('now')),
      fuente     TEXT DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS merma_registro (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        TEXT NOT NULL REFERENCES users(id),
      nombre         TEXT NOT NULL,
      ingrediente_id INTEGER,
      cantidad       REAL,
      unidad         TEXT,
      motivo         TEXT,
      coste_estimado REAL,
      fecha          TEXT DEFAULT (date('now')),
      notas          TEXT
    );

    CREATE TABLE IF NOT EXISTS lineas_albaran_compra (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL REFERENCES users(id),
      albaran_id      INTEGER,
      vendor          TEXT,
      nombre          TEXT,
      cantidad        REAL,
      unidad          TEXT,
      precio_unitario REAL,
      total_linea     REAL,
      fecha           TEXT DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS ventas_produccion (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   TEXT NOT NULL REFERENCES users(id),
      receta_id INTEGER,
      nombre    TEXT,
      raciones  INTEGER,
      fecha     TEXT DEFAULT (date('now')),
      notas     TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  const hash = bcrypt.hashSync('Marginbites2026+', 10)
  db.prepare(`
    INSERT OR IGNORE INTO users (id, email, password_hash, name)
    VALUES ('pablo-admin', 'pabloperez@visualandgrowth.es', ?, 'Pablo Perez')
  `).run(hash)

  // Auto-seed demo data if DB is empty (new installation or after data loss)
  const ingCount = (db.prepare('SELECT COUNT(*) as c FROM ingredientes WHERE user_id=?').get('pablo-admin') as any).c
  if (ingCount === 0) {
    seedDemoData(db, 'pablo-admin')
  }
}


function getDb(): Database.Database {
  if (!global._db) {
    global._db = new Database(DB_PATH)
    initSchema(global._db)
  }
  return global._db
}

const db = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const instance = getDb()
    const val = (instance as any)[prop]
    return typeof val === 'function' ? val.bind(instance) : val
  },
})

export default db

export type User = {
  id: string
  email: string
  name: string | null
  google_id: string | null
  avatar: string | null
  created_at: string
}
