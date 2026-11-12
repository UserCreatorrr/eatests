// Registro ordenado de migraciones. Una migración aplicada no se edita jamás:
// su checksum queda guardado y un cambio posterior se detecta al arrancar.
import { sql as m0001 } from './0001_initial'

export interface Migration {
  id: number
  name: string
  sql: string
}

export const migrations: Migration[] = [
  { id: 1, name: 'initial', sql: m0001 },
]
