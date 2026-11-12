// Aplica las migraciones pendientes, cada una en su transacción, y guarda el
// checksum de lo aplicado. Si una migración ya aplicada cambia en el código,
// se aborta: eso es un error de desarrollo, no algo que se "arregle" solo.
import { createHash } from 'crypto'
import type Database from 'better-sqlite3'
import { migrations, type Migration } from './migrations'

const checksum = (s: string) => createHash('sha256').update(s).digest('hex')

export function runMigrations(db: Database.Database): { applied: string[] } {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    checksum   TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`)

  const done = new Map<number, { name: string; checksum: string }>()
  for (const r of db.prepare('SELECT id, name, checksum FROM schema_migrations').all() as any[]) {
    done.set(r.id, r)
  }

  const applied: string[] = []
  const insert = db.prepare('INSERT INTO schema_migrations (id, name, checksum) VALUES (?, ?, ?)')

  migrations.forEach((m: Migration, i) => {
    if (m.id !== i + 1) throw new Error(`Migración fuera de orden: ${m.id} en posición ${i + 1}`)
    const sum = checksum(m.sql)
    const prev = done.get(m.id)
    if (prev) {
      if (prev.checksum !== sum) {
        throw new Error(`La migración ${m.id} (${prev.name}) ya está aplicada y su SQL ha cambiado`)
      }
      return
    }
    // Las FK se apagan solo durante el DDL; cada migración es atómica.
    db.pragma('foreign_keys = OFF')
    try {
      db.transaction(() => {
        db.exec(m.sql)
        insert.run(m.id, m.name, sum)
      })()
    } finally {
      db.pragma('foreign_keys = ON')
    }
    applied.push(`${m.id}_${m.name}`)
  })

  const fkErrors = db.pragma('foreign_key_check') as any[]
  if (fkErrors.length) throw new Error(`Claves foráneas rotas tras migrar: ${JSON.stringify(fkErrors.slice(0, 5))}`)
  return { applied }
}
