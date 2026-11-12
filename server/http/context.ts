// Contexto de una petición autenticada: quién es, en qué organización y con
// qué rol. Los servicios reciben esto, nunca la petición HTTP.
import type { DB } from '@/server/db/connection'

export type Role = 'owner' | 'manager' | 'staff'

export interface Ctx {
  db: DB
  userId: string
  email: string
  orgId: number
  role: Role
  sessionId: string
}
