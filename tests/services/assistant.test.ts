// El asistente: herramientas sobre servicios y bucle con un LLM falso.
import { beforeEach, describe, expect, it } from 'vitest'
import type { Llm, LlmResult } from '@/server/adapters/openai'
import { executeTool, runAssistant } from '@/server/services/assistant'
import { createIngredient, createSupplier, getIngredient } from '@/server/services/catalog'
import { encrypt, decrypt } from '@/server/adapters/crypto'
import { getGmailTokens, sendOrder, storeGmailTokens } from '@/server/services/messaging'
import { createInvoice, listInvoices, listOrders } from '@/server/services/purchasing'
import { addLine, createRecipe } from '@/server/services/recipes'
import { listWaste } from '@/server/services/waste'
import type { Ctx } from '@/server/http/context'
import { testCtx } from '../helpers'

let ctx: Ctx
beforeEach(() => {
  ctx = testCtx()
  createSupplier(ctx, { name: 'Makro', email: 'pedidos@makro.test', phone: '600 11 22 33' })
  createIngredient(ctx, { name: 'Pollo', baseUnit: 'kg', cost: 6, supplierId: 1 })
  const r = createRecipe(ctx, { name: 'Pollo asado', portions: 2, salePrice: 5 }).id
  addLine(ctx, r, { ingredientId: 1, qty: 1, unit: 'kg' })
})

const toolCall = (name: string, args: object): LlmResult => ({ content: null, finishReason: 'tool_calls', toolCalls: [{ id: 'c1', name, arguments: JSON.stringify(args) }] })
const text = (content: string): LlmResult => ({ content, finishReason: 'stop', toolCalls: [] })
const scripted = (...steps: LlmResult[]): Llm => { let i = 0; return async () => steps[Math.min(i++, steps.length - 1)] }

describe('herramientas', () => {
  it('albarán dictado: crea proveedor nuevo, mapea líneas, valida y devuelve impacto en food cost', async () => {
    const out = await executeTool(ctx, 'guardar_albaran_completo', { vendor: 'Makro', delivery_num: 'A-1', date_delivery: '2026-11-10', lineas: [{ nombre: 'pollo', cantidad: 2, unidad: 'kg', precio_unitario: 9, total_linea: 18 }] })
    expect(out.startsWith('__ALBARAN_GUARDADO__')).toBe(true)
    const data = JSON.parse(out.slice('__ALBARAN_GUARDADO__'.length))
    expect(data).toMatchObject({ estado: 'validated', delivery_num: 'A-1' })
    expect(data.price_changes[0]).toMatchObject({ nombre: 'Pollo', precio_anterior: 6, precio_nuevo: 9, diff_pct: 50 })
    expect(data.food_cost_impact).toMatch(/Pollo asado: 90% \[CRITICO\]/)
    expect(getIngredient(ctx, 1).cost).toBe(9)
  })
  it('facturas: listar y marcar pagadas por proveedor', async () => {
    createInvoice(ctx, { supplierId: 1, number: 'F1', invoiceDate: '2026-10-01', dueDate: '2026-10-30', base: 100, vat: 10, total: 110 })
    const list = JSON.parse((await executeTool(ctx, 'listar_facturas_para_pagar', {})).slice('__FACTURAS_PAGAR__'.length))
    expect(list.facturas[0]).toMatchObject({ invoice_num: 'F1', vendor: 'Makro', total: 110, vencida: true })
    expect(await executeTool(ctx, 'marcar_factura_pagada', {})).toMatch(/Necesito/)
    expect(await executeTool(ctx, 'marcar_factura_pagada', { vendor: 'mak' })).toMatch(/1 factura marcada/)
    expect(listInvoices(ctx, { status: 'pending' })).toEqual([])
  })
  it('merma, precio, producción y compra semanal pasan por los servicios', async () => {
    expect(await executeTool(ctx, 'registrar_merma', { nombre: 'pollo', cantidad: 500, unidad: 'g', motivo: 'caducidad' })).toMatch(/Merma registrada.*3€/)
    expect(listWaste(ctx)[0]).toMatchObject({ ingredient_id: 1, estimated_cost: 3 })
    expect(await executeTool(ctx, 'registrar_precio', { nombre: 'Pollo', precio: 0.007, unidad: 'g', vendor: 'Makro' })).toMatch(/7€\/kg.*\(\+16\.7%\)/)
    expect(await executeTool(ctx, 'registrar_produccion', { nombre: 'pollo asado', raciones: 4 })).toMatch(/× 4/)
    const w = JSON.parse((await executeTool(ctx, 'calcular_compra_semanal', { platos: [{ nombre: 'Pollo asado', raciones: 10 }, { nombre: 'Nada', raciones: 1 }] })).slice('__COMPRA_SEMANAL__'.length))
    expect(w.platos[1].encontrada).toBe(false)
    expect(w.grupos[0].proveedor.nombre).toBe('Makro')
    expect(w.grupos[0].items[0]).toMatchObject({ nombre: 'Pollo', cantidad: 5, unidad: 'kg', subtotal: 35 })
    expect(w.coste_total_estimado).toBe(35)
  })
  it('navegación y proposiciones de pedido', async () => {
    expect(JSON.parse((await executeTool(ctx, 'navegar', { ruta: '/dashboard/compras/facturas' })).slice('__NAVIGATE__'.length)).path).toBe('/dashboard/compras/facturas')
    const wa = JSON.parse((await executeTool(ctx, 'proponer_pedido_whatsapp', { proveedor_nombre: 'makro', items: [{ nombre: 'Pollo', cantidad: 5, unidad: 'kg' }] })).slice('__WHATSAPP_PROPOSAL__'.length))
    expect(wa).toMatchObject({ proveedor: 'Makro', proveedor_id: 1, phone: '600 11 22 33' })
    expect(wa.message).toMatch(/Pollo: 5 kg/)
  })
})

describe('bucle', () => {
  it('tarjeta terminal corta el bucle; consulta normal realimenta al modelo y devuelve su respuesta', async () => {
    const r1 = await runAssistant(ctx, { messages: [{ role: 'user', content: 'qué debo pagar' }] }, scripted(toolCall('listar_facturas_para_pagar', {})))
    expect(r1.reply).toBe('')
    expect(r1.facturasPagar).toEqual({ facturas: [] })
    expect(r1.suggestions[0]).toMatch(/vencen/)

    const seen: any[] = []
    const llm: Llm = async req => { seen.push(req.messages); return seen.length === 1 ? toolCall('resumen_gastos', { periodo: 'este_mes' }) : text('Este mes no hay gasto.') }
    const r2 = await runAssistant(ctx, { messages: [{ role: 'user', content: 'cuánto gastamos' }] }, llm)
    expect(r2.reply).toBe('Este mes no hay gasto.')
    expect(r2.action).toBe('resumen_gastos')
    expect(seen[1].find((m: any) => m.role === 'tool').content).toMatch(/Gasto: 0€/)
  })
  it('un error en la herramienta vuelve al modelo como texto, nunca como 500', async () => {
    const llm = scripted(toolCall('registrar_merma', { nombre: 'Pollo', cantidad: 1, unidad: 'l' }), text('No se pudo.'))
    const r = await runAssistant(ctx, { messages: [{ role: 'user', content: 'merma' }] }, llm)
    expect(r.reply).toBe('No se pudo.')
    expect(listWaste(ctx)).toEqual([])
  })
})

describe('mensajería', () => {
  it('envía el pedido y lo marca enviado; si el transporte falla queda en borrador', async () => {
    const sent: any[] = []
    const r = await sendOrder(ctx, { supplierId: 1, channel: 'email', message: 'Hola', items: [{ ingredientId: 1, description: 'Pollo', qty: 5, unit: 'kg' }] }, { email: async m => { sent.push(m) } })
    expect(r.order).toMatchObject({ status: 'sent', sent_via: 'email' })
    expect(sent[0]).toMatchObject({ to: 'pedidos@makro.test', subject: `Pedido ${r.order.number}` })
    expect(sent[0].html).toMatch(/Pollo/)
    await expect(sendOrder(ctx, { supplierId: 1, channel: 'whatsapp', message: 'Hola', items: [{ description: 'Pollo', qty: 1 }] }, { whatsapp: async () => { throw new Error('caído') } })).rejects.toThrow(/queda en borrador/)
    expect(listOrders(ctx).map(o => o.status).sort()).toEqual(['draft', 'sent'])
    await expect(sendOrder(ctx, { supplierId: 1, channel: 'whatsapp', to: '12', message: 'x', items: [{ description: 'Pollo', qty: 1 }] }, { whatsapp: async () => {} })).rejects.toThrow(/Teléfono no válido/)
  })
  it('los tokens de Gmail se guardan cifrados y los heredados en claro se cifran al leer', () => {
    expect(decrypt(encrypt('hola'))).toBe('hola')
    ctx.db.prepare(`INSERT INTO app_settings (key, value) VALUES ('gmail_tokens', ?)`).run(JSON.stringify({ refresh_token: 'r1' }))
    expect(getGmailTokens(ctx.db)).toEqual({ refresh_token: 'r1' })
    const stored = (ctx.db.prepare(`SELECT value FROM app_settings WHERE key = 'gmail_tokens'`).get() as any).value
    expect(stored.startsWith('v1:')).toBe(true)
    expect(stored).not.toMatch(/r1/)
    storeGmailTokens(ctx.db, { refresh_token: 'r2' })
    expect(getGmailTokens(ctx.db).refresh_token).toBe('r2')
  })
})
