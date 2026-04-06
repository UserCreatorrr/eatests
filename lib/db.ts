import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import path from 'path'
import fs from 'fs'

const DB_PATH =
  process.env.DB_PATH ||
  (process.env.NODE_ENV === 'production' ? '/data/marginbites.db' : './marginbites.db')

// Ensure the directory exists before opening (needed at build time and runtime)
fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true })

declare global {
  // eslint-disable-next-line no-var
  var _db: Database.Database | undefined
}

// Bump this number whenever the schema changes to trigger a rebuild of entity tables
const SCHEMA_VERSION = 2

function initSchema(db: Database.Database) {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Users table — never dropped
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name          TEXT,
      google_id     TEXT UNIQUE,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS _schema_version (
      version INTEGER NOT NULL
    );
  `)

  // Check schema version and rebuild entity tables if outdated
  const row = db.prepare('SELECT version FROM _schema_version LIMIT 1').get() as { version: number } | undefined
  if (!row || row.version < SCHEMA_VERSION) {
    db.exec(`
      DROP TABLE IF EXISTS ingredientes;
      DROP TABLE IF EXISTS herramientas;
      DROP TABLE IF EXISTS proveedores;
      DROP TABLE IF EXISTS proveedores_detalle;
      DROP TABLE IF EXISTS lista_pedidos;
      DROP TABLE IF EXISTS pedidos_compra;
      DROP TABLE IF EXISTS albaranes_compra;
      DROP TABLE IF EXISTS albaranes_venta;
      DROP TABLE IF EXISTS facturas_compra;
      DROP TABLE IF EXISTS facturas_venta;
      DROP TABLE IF EXISTS escandallo_receta;
      DELETE FROM _schema_version;
      INSERT INTO _schema_version (version) VALUES (${SCHEMA_VERSION});
    `)
  }

  // Entity tables — column names match TSpoonLab camelCase exactly
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingredientes (
      id        TEXT PRIMARY KEY,
      user_id   TEXT NOT NULL REFERENCES users(id),
      codi      TEXT,
      descr     TEXT,
      type      TEXT,
      hasData   INTEGER,
      unit      TEXT,
      idUnit    INTEGER,
      cost      REAL,
      color     TEXT
    );

    CREATE TABLE IF NOT EXISTS herramientas (
      id        TEXT PRIMARY KEY,
      user_id   TEXT NOT NULL REFERENCES users(id),
      codi      TEXT,
      descr     TEXT,
      type      TEXT,
      hasData   INTEGER,
      unit      TEXT,
      idUnit    INTEGER,
      cost      REAL
    );

    CREATE TABLE IF NOT EXISTS proveedores (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      codi        TEXT,
      descr       TEXT,
      defecte     INTEGER,
      descrType   TEXT,
      idType      TEXT,
      hasOther    INTEGER,
      nif         TEXT,
      altDescr    TEXT,
      comment     TEXT,
      address     TEXT,
      city        TEXT,
      cp          TEXT,
      contact     TEXT,
      phone       TEXT,
      mail        TEXT,
      contactAux  TEXT,
      phoneAux    TEXT,
      mailAux     TEXT,
      mailcc      TEXT,
      web         TEXT,
      locked      INTEGER,
      replicated  INTEGER
    );

    CREATE TABLE IF NOT EXISTS proveedores_detalle (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      codi        TEXT,
      descr       TEXT,
      nif         TEXT,
      altDescr    TEXT,
      comment     TEXT,
      deliveryComment TEXT,
      mailcc      TEXT,
      web         TEXT,
      address     TEXT,
      city        TEXT,
      cp          TEXT,
      contact     TEXT,
      phone       TEXT,
      mail        TEXT,
      contactAux  TEXT,
      phoneAux    TEXT,
      mailAux     TEXT
    );

    CREATE TABLE IF NOT EXISTS lista_pedidos (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id),
      descr           TEXT,
      data            TEXT,
      defecte         INTEGER,
      year            INTEGER,
      month           INTEGER,
      pendingSend     INTEGER,
      pendingReceive  INTEGER,
      locked          INTEGER,
      replicated      INTEGER
    );

    CREATE TABLE IF NOT EXISTS pedidos_compra (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id),
      numOrder        TEXT,
      vendor          TEXT,
      codeVendor      TEXT,
      nif             TEXT,
      dateOrder       INTEGER,
      dateReception   INTEGER,
      sentBy          TEXT,
      total           REAL
    );

    CREATE TABLE IF NOT EXISTS albaranes_compra (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id),
      vendor          TEXT,
      deliveryNum     TEXT,
      nif             TEXT,
      date            INTEGER,
      dateFormatted   TEXT,
      dateSent        INTEGER,
      dateSentFormatted TEXT,
      sentBy          TEXT,
      receivedBy      TEXT,
      base            REAL,
      taxes           REAL,
      total           REAL,
      costType        TEXT,
      codeCostType    TEXT
    );

    CREATE TABLE IF NOT EXISTS albaranes_venta (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id),
      idCustomer      TEXT,
      customer        TEXT,
      customerCode    TEXT,
      customerType    TEXT,
      nif             TEXT,
      contact         TEXT,
      phone           TEXT,
      mail            TEXT,
      address         TEXT,
      cp              TEXT,
      city            TEXT,
      invoiceNum      TEXT,
      date            INTEGER,
      base            REAL
    );

    CREATE TABLE IF NOT EXISTS facturas_compra (
      id                TEXT PRIMARY KEY,
      user_id           TEXT NOT NULL REFERENCES users(id),
      idVendor          TEXT,
      vendor            TEXT,
      codeVendor        TEXT,
      accountVendor     TEXT,
      nif               TEXT,
      documentNum       TEXT,
      invoiceNum        TEXT,
      paid              INTEGER,
      validated         INTEGER,
      comment           TEXT,
      date              INTEGER,
      dateAccounting    INTEGER,
      dateDue           INTEGER,
      codePaymentType   TEXT,
      total             REAL,
      base              REAL,
      taxes             REAL
    );

    CREATE TABLE IF NOT EXISTS facturas_venta (
      id                TEXT PRIMARY KEY,
      user_id           TEXT NOT NULL REFERENCES users(id),
      idCustomer        TEXT,
      customer          TEXT,
      codeCustomer      TEXT,
      accountCustomer   TEXT,
      nif               TEXT,
      documentNum       TEXT,
      invoiceNum        TEXT,
      paid              INTEGER,
      comment           TEXT,
      date              INTEGER,
      dateAccounting    INTEGER,
      dateDue           INTEGER,
      codePaymentType   TEXT,
      total             REAL,
      base              REAL,
      taxes             REAL
    );

    CREATE TABLE IF NOT EXISTS escandallo_receta (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id),
      nombre       TEXT,
      categoria    TEXT,
      descripcion  TEXT,
      raciones     INTEGER,
      precioVenta  REAL,
      ingredientes TEXT,
      mermaPct     REAL,
      notas        TEXT,
      activo       INTEGER DEFAULT 1
    );
  `)

  // Seed admin user
  const hash = bcrypt.hashSync('Marginbites2026+', 10)
  db.prepare(`
    INSERT OR IGNORE INTO users (id, email, password_hash, name)
    VALUES ('pablo-admin', 'pabloperez@visualandgrowth.es', ?, 'Pablo Perez')
  `).run(hash)
}

function getDb(): Database.Database {
  if (!global._db) {
    global._db = new Database(DB_PATH)
    initSchema(global._db)
  }
  return global._db
}

// Lazy proxy: DB only opens on first method call (not at import time / build time)
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
  created_at: string
}
