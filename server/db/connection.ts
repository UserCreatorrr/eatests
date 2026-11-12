// Única conexión a SQLite del proceso. Pragmas de producción y migraciones al
// abrir. `openDatabase(':memory:')` sirve para tests.
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { runMigrations } from './migrate'

export type DB = Database.Database

export function openDatabase(file: string): DB {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  runMigrations(db)
  return db
}

const DB_PATH =
  process.env.DB_PATH ||
  (process.env.NODE_ENV === 'production' ? '/data/marginbite-v2.db' : './marginbite-v2.db')

declare global {
  // eslint-disable-next-line no-var
  var __mbdb: DB | undefined
}

/** Conexión compartida (sobrevive al hot reload de Next en desarrollo). */
export function getDb(): DB {
  if (!globalThis.__mbdb) globalThis.__mbdb = openDatabase(DB_PATH)
  return globalThis.__mbdb
}

/** Solo tests: sustituye la conexión compartida por una BD en memoria. */
export function useDatabase(db: DB | undefined): void {
  globalThis.__mbdb = db
}
