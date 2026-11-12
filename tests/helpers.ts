// Contexto de prueba: una organización nueva sobre SQLite en memoria.
import { openDatabase, type DB } from '@/server/db/connection'
import type { Ctx } from '@/server/http/context'

export function testCtx(db?: DB, orgName = 'Test'): Ctx {
  const d = db ?? openDatabase(':memory:')
  const userId = `u-${orgName.toLowerCase()}`
  d.prepare('INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)').run(userId, `${orgName.toLowerCase()}@test.local`, orgName)
  const org = d.prepare('INSERT INTO organizations (name) VALUES (?)').run(orgName)
  const orgId = Number(org.lastInsertRowid)
  d.prepare(`INSERT INTO memberships (org_id, user_id, role) VALUES (?, ?, 'owner')`).run(orgId, userId)
  return { db: d, userId, email: `${orgName.toLowerCase()}@test.local`, orgId, role: 'owner', sessionId: 's-test' }
}
