// Merma, analítica, avisos, notificaciones y daily brief sobre un escenario común.
import { beforeEach, describe, expect, it } from 'vitest'
import { computeAlerts } from '@/server/services/alerts'
import { consumption, dashboard, priceDeviations } from '@/server/services/analytics'
import { createIngredient, createSupplier } from '@/server/services/catalog'
import { createSalesSlot, createShift } from '@/server/services/labor'
import { generateFromAlerts, listNotifications, markAllRead, markRead } from '@/server/services/notifications'
import { createDeliveryNote, createInvoice, validateDeliveryNote } from '@/server/services/purchasing'
import { addLine, createRecipe, registerProduction } from '@/server/services/recipes'
import { dailyBrief } from '@/server/services/reports'
import { stockLevels } from '@/server/services/stock'
import { registerWaste, removeWaste, wasteStats } from '@/server/services/waste'
import type { Ctx } from '@/server/http/context'
import { testCtx } from '../helpers'

let ctx: Ctx
let makro: number, tomate: number, pollo: number, plato: number
beforeEach(() => {
  ctx = testCtx()
  makro = createSupplier(ctx, { name: 'Makro' }).id
  tomate = createIngredient(ctx, { name: 'Tomate', baseUnit: 'kg', cost: 2, supplierId: makro }).id
  pollo = createIngredient(ctx, { name: 'Pollo', baseUnit: 'kg', cost: 6, supplierId: makro }).id
  plato = createRecipe(ctx, { name: 'Pollo con tomate', portions: 4, salePrice: 10 }).id
  addLine(ctx, plato, { ingredientId: pollo, qty: 1, unit: 'kg' })
  addLine(ctx, plato, { ingredientId: tomate, qty: 500, unit: 'g' })
})

describe('merma', () => {
  it('coste automático en unidad base, unidad incompatible rechazada, plato por ración', () => {
    const w = registerWaste(ctx, { ingredientId: tomate, qty: 250, unit: 'g', reason: 'Caducado', occurredOn: '2026-11-10' })
    expect(w).toMatchObject({ kind: 'ingredient', description: 'Tomate', estimated_cost: 0.5, occurred_on: '2026-11-10' })
    expect(() => registerWaste(ctx, { ingredientId: tomate, qty: 1, unit: 'l' })).toThrow(/se mide en kg/)
    // plato: coste 6 + 1 = 7 € / 4 raciones = 1,75 €/ración
    const d = registerWaste(ctx, { recipeId: plato, qty: 2, unit: 'ud', occurredOn: '2026-11-10' })
    expect(d).toMatchObject({ kind: 'dish', estimated_cost: 3.5 })
    expect(() => registerWaste(ctx, { recipeId: plato, qty: 1, unit: 'kg' })).toThrow(/raciones/)
    const s = wasteStats(ctx, '2026-11')
    expect(s.month_total).toEqual({ n: 2, cost: 4 })
    expect(s.byReason[0]).toMatchObject({ reason: 'Sin motivo', cost: 3.5 })
  })
  it('con consumeStock descuenta del almacén y entonces no se puede borrar', () => {
    const w = registerWaste(ctx, { ingredientId: pollo, qty: 500, unit: 'g', consumeStock: true })
    expect(stockLevels(ctx, { ingredientId: pollo })[0].qty).toBe(-0.5)
    expect(() => removeWaste(ctx, w.id)).toThrow(/ajuste/)
    const w2 = registerWaste(ctx, { description: 'Pan', qty: 3, unit: 'ud', estimatedCost: 1.2 })
    removeWaste(ctx, w2.id)
    expect(() => removeWaste(ctx, w2.id)).toThrow(/no encontrado/)
  })
})

function buy(c: Ctx, opts: { number: string; date: string; price: number; qty?: number; supplierId?: number; ingredientId?: number }) {
  const dn = createDeliveryNote(c, { supplierId: opts.supplierId ?? makro, number: opts.number, deliveryDate: opts.date, base: (opts.qty ?? 10) * opts.price,
    lines: [{ ingredientId: opts.ingredientId ?? pollo, description: 'Pollo', qty: opts.qty ?? 10, unit: 'kg', unitPrice: opts.price }] })
  validateDeliveryNote(c, dn.id)
  return dn
}

describe('analítica', () => {
  it('desviaciones de precio con impacto mensual y diferencial entre proveedores en unidad base', () => {
    buy(ctx, { number: 'A1', date: '2026-10-05', price: 6 })
    buy(ctx, { number: 'A2', date: '2026-11-05', price: 7.2 })
    const otro = createSupplier(ctx, { name: 'Lonja' }).id
    const dn = createDeliveryNote(ctx, { supplierId: otro, number: 'L1', deliveryDate: '2026-11-06', base: 5, lines: [{ ingredientId: pollo, description: 'Pollo', qty: 1000, unit: 'g', unitPrice: 0.005 }] })
    validateDeliveryNote(ctx, dn.id, { applyPrices: false })
    const r = priceDeviations(ctx, '2026-11-10')
    const dev = r.deviations.find(d => d.name === 'Pollo')!
    expect(dev).toMatchObject({ previous: 6, current: 7.2, changePct: 20, level: 'high' })
    expect(dev.monthlyImpact).toBe(Math.round(0.2 * (72 + 5)))
    expect(r.inconsistencies[0]).toMatchObject({ name: 'Pollo', diffPct: 44, potentialSaving: 2.2 })
    expect(r.inconsistencies[0].suppliers.map(s => s.pricePerBase).sort()).toEqual([5, 7.2])
  })
  it('panel: el gasto son facturas, nunca pedidos ni albaranes sumados', () => {
    const dn = buy(ctx, { number: 'A1', date: '2026-11-05', price: 6 })
    createInvoice(ctx, { supplierId: makro, number: 'F1', invoiceDate: '2026-11-06', base: 60, vat: 6, total: 66, deliveryNoteIds: [dn.id] })
    const d = dashboard(ctx, '2026-11-10')
    expect(d.kpis).toMatchObject({ spendThisMonth: 66, spendLastMonth: 0, ingredients: 2, suppliers: 1, activeRecipes: 1 })
    expect(d.topSuppliers[0]).toMatchObject({ name: 'Makro', total: 66 })
    expect(d.invoiceStats).toMatchObject({ total: 1, pending: 1, pendingAmount: 66 })
  })
  it('consumo teórico explota la receta y compara con compras en unidad base', () => {
    registerProduction(ctx, { recipeId: plato, portions: 8, producedOn: '2026-11-08' })
    buy(ctx, { number: 'A1', date: '2026-11-05', price: 6, qty: 3 })
    const c = consumption(ctx, '2026-11')
    expect(c.hasProduction).toBe(true)
    const polloRow = c.comparison.find(x => x.name === 'Pollo')!
    expect(polloRow).toMatchObject({ theoretical: 2, purchased: 3, difference: 1, unit: 'kg' })
    const tomateRow = c.comparison.find(x => x.name === 'Tomate')!
    expect(tomateRow).toMatchObject({ theoretical: 1, purchased: null })
    expect(tomateRow.note).toMatch(/Sin compras/)
  })
})

describe('avisos y notificaciones', () => {
  it('cada aviso sale de un dato real y las notificaciones no se repiten en el día', async () => {
    createInvoice(ctx, { supplierId: makro, number: 'F-OLD', invoiceDate: '2026-09-01', dueDate: '2026-10-01', base: 100, vat: 10, total: 110 })
    createIngredient(ctx, { name: 'Azafrán', baseUnit: 'g' })
    const caro = createRecipe(ctx, { name: 'Caro', portions: 1, salePrice: 5 }).id
    addLine(ctx, caro, { ingredientId: pollo, qty: 1, unit: 'kg' })
    const alerts = computeAlerts(ctx, '2026-11-10')
    const ids = alerts.map(a => a.id)
    expect(ids).toContain('facturas_vencidas')
    expect(ids).toContain('food_cost_critico')
    expect(ids).toContain('reposicion')
    expect(ids).not.toContain('ingredientes_sin_coste')
    expect(alerts.find(a => a.id === 'facturas_vencidas')!.detalle).toMatch(/110,00/)

    const pushed: string[] = []
    const n = await generateFromAlerts(ctx, async (_u, p) => { pushed.push(p.title) })
    expect(n).toBeGreaterThan(0)
    expect(pushed.length).toBeGreaterThan(0)
    expect(await generateFromAlerts(ctx, async () => {})).toBe(0)
    const list = listNotifications(ctx)
    expect(list.unread).toBe(n)
    markRead(ctx, list.notifications[0].id)
    expect(listNotifications(ctx).unread).toBe(n - 1)
    expect(markAllRead(ctx)).toBe(n - 1)
    expect(() => markRead(ctx, 999)).toThrow(/no encontrada/)
  })
})

describe('daily brief', () => {
  it('KPIs con contrato de sin datos, prioridades únicas y un registro por día', () => {
    createShift(ctx, { shiftDate: '2026-11-09', startTime: '12:00', endTime: '16:00', employeeName: 'Ana', hourlyCost: 20 })
    createSalesSlot(ctx, { saleDate: '2026-11-09', slotStart: '12:00', slotEnd: '16:00', netSales: 200 })
    registerWaste(ctx, { ingredientId: pollo, qty: 1, unit: 'kg', occurredOn: '2026-11-09' })
    const b = dailyBrief(ctx, { date: '2026-11-10' })
    expect(b.kpis.ventas.ayer).toBe(200)
    expect(b.kpis.labor).toMatchObject({ pct: 40, coste: 80, horas_plan: 4 })
    expect(b.kpis.food_cost.pct).toBeNull()
    expect(b.kpis.merma).toMatchObject({ total: 6, eventos: 1 })
    expect(b.alertas.map(a => a.titulo)).toContain('Labor cost por encima del 30%')
    expect(b.prioridades).toEqual(['Analizar merma de ayer (1 eventos, 6€)'])
    expect(b.data_quality).toBe('PARCIAL')
    expect(b.missing.map(m => m.dato)).toEqual(['Compras (7 días)'])
    dailyBrief(ctx, { date: '2026-11-10' })
    expect((ctx.db.prepare('SELECT COUNT(*) AS c FROM report_briefs WHERE org_id = ?').get(ctx.orgId) as any).c).toBe(1)
    expect(() => dailyBrief(ctx, { scope: 'location' })).toThrow(/centro/)
  })
})
