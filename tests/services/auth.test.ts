import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DB } from '@/server/db/connection'
import { ConflictError, UnauthorizedError, ValidationError } from '@/server/domain/errors'
import { authenticate, login, logout, register, revokeAllSessions } from '@/server/services/auth'

let db: DB
beforeEach(() => { db = openDatabase(':memory:') })

describe('registro e inicio de sesión', () => {
  it('crea usuario, organización propia y sesión', async () => {
    const s = await register(db, { email: 'Ana@Test.com', password: 'secreta123', name: 'Ana' })
    expect(s.role).toBe('owner')
    const ctx = await authenticate(db, s.token)
    expect(ctx?.email).toBe('ana@test.com')
    expect(ctx?.orgId).toBe(s.orgId)
    expect(db.prepare('SELECT name FROM organizations WHERE id = ?').get(s.orgId)).toEqual({ name: 'Ana' })
  })
  it('valida la entrada', async () => {
    await expect(register(db, { email: 'no-es-email', password: 'secreta123' })).rejects.toThrow(ValidationError)
    await expect(register(db, { email: 'a@b.co', password: 'corta' })).rejects.toThrow(ValidationError)
    await expect(register(db, { email: 'a@b.co', password: 12345678 })).rejects.toThrow(ValidationError)
  })
  it('no admite dos cuentas con el mismo email', async () => {
    await register(db, { email: 'a@b.co', password: 'secreta123' })
    await expect(register(db, { email: 'A@B.CO', password: 'secreta123' })).rejects.toThrow(ConflictError)
  })
  it('rechaza credenciales malas con el mismo mensaje exista o no el usuario', async () => {
    await register(db, { email: 'a@b.co', password: 'secreta123' })
    await expect(login(db, { email: 'a@b.co', password: 'otra-cosa-1' })).rejects.toThrow('Credenciales incorrectas')
    await expect(login(db, { email: 'nadie@b.co', password: 'otra-cosa-1' })).rejects.toThrow('Credenciales incorrectas')
    await expect(login(db, { email: 'a@b.co', password: 'secreta123' })).resolves.toMatchObject({ role: 'owner' })
  })
})

describe('sesiones revocables', () => {
  it('cerrar sesión invalida el token aunque alguien lo haya copiado', async () => {
    const s = await login(db, await register(db, { email: 'a@b.co', password: 'secreta123' }).then(() => ({ email: 'a@b.co', password: 'secreta123' })))
    expect(await authenticate(db, s.token)).not.toBeNull()
    logout(db, s.sessionId)
    expect(await authenticate(db, s.token)).toBeNull()
  })
  it('revocar todas las sesiones de un usuario', async () => {
    await register(db, { email: 'a@b.co', password: 'secreta123' })
    const s1 = await login(db, { email: 'a@b.co', password: 'secreta123' })
    const s2 = await login(db, { email: 'a@b.co', password: 'secreta123' })
    revokeAllSessions(db, s1.userId)
    expect(await authenticate(db, s1.token)).toBeNull()
    expect(await authenticate(db, s2.token)).toBeNull()
  })
  it('un token manipulado o de otro secreto no entra', async () => {
    const s = await register(db, { email: 'a@b.co', password: 'secreta123' })
    expect(await authenticate(db, s.token.slice(0, -2) + 'xx')).toBeNull()
    expect(await authenticate(db, undefined)).toBeNull()
  })
  it('lanza UnauthorizedError si el usuario no tiene organización', async () => {
    await register(db, { email: 'a@b.co', password: 'secreta123' })
    db.exec('DELETE FROM memberships')
    await expect(login(db, { email: 'a@b.co', password: 'secreta123' })).rejects.toThrow(UnauthorizedError)
  })
})
