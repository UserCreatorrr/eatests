// La pila completa: ruta → zod → servicio → BD, con el sobre de error único.
import { beforeEach, describe, expect, it } from 'vitest'
import * as login from '@/app/api/auth/login/route'
import * as logout from '@/app/api/auth/logout/route'
import * as me from '@/app/api/auth/me/route'
import * as registerRoute from '@/app/api/auth/register/route'
import * as ingredients from '@/app/api/ingredients/route'
import * as ingredient from '@/app/api/ingredients/[id]/route'
import * as suppliers from '@/app/api/suppliers/route'
import * as notes from '@/app/api/delivery-notes/route'
import * as validate from '@/app/api/delivery-notes/[id]/validate/route'
import * as invoices from '@/app/api/invoices/route'
import * as stock from '@/app/api/stock/route'
import * as recipes from '@/app/api/recipes/route'
import * as recipeLines from '@/app/api/recipes/[id]/lines/route'
import { call, freshDb, signUp } from './harness'
import type { DB } from '@/server/db/connection'

let db: DB, cookie: string
beforeEach(async () => { db = freshDb(); cookie = await signUp(db) })

describe('auth por HTTP', () => {
  it('registra, entra, cierra sesión y el token muerto ya no vale', async () => {
    const r = await call(registerRoute.POST, { body: { email: 'b@test.com', password: 'secreta123' } })
    expect(r.status).toBe(200)
    expect(r.setCookie).toMatch(/mb_session=.+HttpOnly/)
    const bad = await call(login.POST, { body: { email: 'b@test.com', password: 'mal-mal-mal' } })
    expect(bad.status).toBe(401)
    expect(bad.json).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Credenciales incorrectas', details: {} } })
    const ok = await call(login.POST, { body: { email: 'b@test.com', password: 'secreta123' } })
    const c = ok.setCookie!.split(';')[0]
    expect((await call(me.GET, { cookie: c })).json.user.email).toBe('b@test.com')
    expect((await call(logout.POST, { method: 'POST', cookie: c })).status).toBe(200)
    expect((await call(me.GET, { cookie: c })).status).toBe(401)
  })
  it('JSON roto es 400, no 500; sin cookie es 401', async () => {
    const req = new (await import('next/server')).NextRequest('http://t/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{roto' })
    const res = await registerRoute.POST(req)
    expect(res.status).toBe(400)
    expect((await call(ingredients.GET, {})).status).toBe(401)
  })
})

describe('validación y errores con sobre único', () => {
  it('zod rechaza y nombra el campo; la BD traduce sus violaciones', async () => {
    const bad = await call(ingredients.POST, { cookie, body: { name: 'X', baseUnit: 'Manojo' } })
    expect(bad.status).toBe(400)
    expect(bad.json.error.code).toBe('VALIDATION_ERROR')
    expect(bad.json.error.message).toMatch(/baseUnit.*no es válida/)
    await call(suppliers.POST, { cookie, body: { name: 'Makro', taxId: 'A28647451' } })
    const dup = await call(suppliers.POST, { cookie, body: { name: 'Makro SA', taxId: 'a-28647451' } })
    expect(dup.status).toBe(409)
    expect(dup.json.error.details.supplierId).toBe(1)
  })
  it('un cliente no ve ni toca lo de otro', async () => {
    const other = await signUp(db, 'otro@test.com')
    const i = await call(ingredients.POST, { cookie, body: { name: 'Secreto', baseUnit: 'kg', cost: 1 } })
    expect((await call(ingredient.GET, { cookie: other, params: { id: String(i.json.id) } })).status).toBe(404)
    expect((await call(ingredient.PATCH, { method: 'PATCH', cookie: other, params: { id: String(i.json.id) }, body: { cost: 99 } })).status).toBe(404)
    expect((await call(ingredients.GET, { cookie: other })).json.data).toEqual([])
  })
})

describe('flujo de compra por HTTP', () => {
  it('albarán → validar → stock y precio; factura agrupa', async () => {
    const sup = (await call(suppliers.POST, { cookie, body: { name: 'Makro' } })).json
    const ing = (await call(ingredients.POST, { cookie, body: { name: 'Pechuga', baseUnit: 'kg', cost: 6.2 } })).json
    const dn = await call(notes.POST, { cookie, body: { supplierId: sup.id, number: 'A1', deliveryDate: '15/08/2026', base: 42.5,
      lines: [{ ingredientId: ing.id, description: 'Pechuga', qty: 5, unit: 'Kg', unitPrice: 8.5 }] } })
    expect(dn.status).toBe(200)
    expect(dn.json.delivery_date).toBe('2026-08-15')
    const v = await call(validate.POST, { cookie, params: { id: String(dn.json.id) }, body: {} })
    expect(v.status).toBe(200)
    expect(v.json.priceChanges[0]).toMatchObject({ previous: 6.2, current: 8.5, changedPct: 37.1 })
    const again = await call(validate.POST, { cookie, params: { id: String(dn.json.id) }, body: {} })
    expect(again.status).toBe(409)
    const st = await call(stock.GET, { cookie })
    expect(st.json.data[0]).toMatchObject({ name: 'Pechuga', qty: 5, value: 42.5 })
    expect(st.json.totalValue).toBe(42.5)
    const inv = await call(invoices.POST, { cookie, body: { supplierId: sup.id, number: 'F-1', invoiceDate: '2026-08-31', base: 42.5, vat: 4.25, total: 46.75, deliveryNoteIds: [dn.json.id] } })
    expect(inv.status).toBe(200)
    expect(inv.json.deliveryNotes[0].status).toBe('invoiced')
  })
})

describe('escandallo por HTTP', () => {
  it('crea receta, añade líneas y devuelve el coste en cada respuesta', async () => {
    const tomate = (await call(ingredients.POST, { cookie, body: { name: 'Tomate', baseUnit: 'kg', cost: 2 } })).json
    const r = (await call(recipes.POST, { cookie, body: { name: 'Plato', portions: 2, salePrice: 6 } })).json
    const l = await call(recipeLines.POST, { cookie, params: { id: String(r.id) }, body: { ingredientId: tomate.id, qty: 180, unit: 'g', wastePct: 40 } })
    expect(l.status).toBe(200)
    expect(l.json.cost).toMatchObject({ total: 0.6, perPortion: 0.3, foodCostPct: 5 })
    const bad = await call(recipeLines.POST, { cookie, params: { id: String(r.id) }, body: { ingredientId: tomate.id, qty: 1, unit: 'l' } })
    expect(bad.status).toBe(400)
    const list = await call(recipes.GET, { cookie })
    expect(list.json.data[0]).toMatchObject({ name: 'Plato', total: 0.6, food_cost_pct: 5 })
  })
})
