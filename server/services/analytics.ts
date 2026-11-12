// Analítica: panel de compras, desviaciones de precio y consumo teórico
// frente a compras. Solo lectura. Una única definición de "gasto":
// facturas de compra. Los pedidos son encargos, no dinero gastado.
import { addDays, today } from '@/server/domain/dates'
import { explodeIngredients } from '@/server/domain/costing'
import { fromCents, round2 } from '@/server/domain/money'
import { baseUnitOf, conversionFactor, parseUnit } from '@/server/domain/units'
import type { Ctx } from '@/server/http/context'
import { recipeCosts, _refs } from './recipes'

const month = (d: string) => d.slice(0, 7)
function prevMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

export function dashboard(ctx: Ctx, ref = today()) {
  const o = ctx.orgId
  const thisMonth = month(ref), lastMonth = prevMonth(thisMonth)
  const spendMonthly = (ctx.db.prepare(`SELECT substr(invoice_date, 1, 7) AS month, SUM(total_cents) AS total_cents, COUNT(*) AS invoices FROM invoices WHERE org_id = ? GROUP BY month ORDER BY month DESC LIMIT 12`).all(o) as any[])
    .map(r => ({ month: r.month, total: fromCents(r.total_cents), invoices: r.invoices })).reverse()
  const topSuppliers = (ctx.db.prepare(`SELECT s.id, s.name, SUM(i.total_cents) AS total_cents, COUNT(*) AS invoices FROM invoices i JOIN suppliers s ON s.id = i.supplier_id
                                        WHERE i.org_id = ? GROUP BY s.id ORDER BY total_cents DESC LIMIT 5`).all(o) as any[])
    .map(r => ({ id: r.id, name: r.name, total: fromCents(r.total_cents), invoices: r.invoices }))
  const inv = ctx.db.prepare(`SELECT COUNT(*) AS total, SUM(status = 'paid') AS paid, SUM(status = 'pending') AS pending,
                              COALESCE(SUM(CASE WHEN status = 'pending' THEN total_cents ELSE 0 END), 0) AS pending_cents, COALESCE(SUM(total_cents), 0) AS total_cents FROM invoices WHERE org_id = ?`).get(o) as any
  const sumMonth = (ym: string) => fromCents((ctx.db.prepare(`SELECT COALESCE(SUM(total_cents), 0) AS c FROM invoices WHERE org_id = ? AND substr(invoice_date, 1, 7) = ?`).get(o, ym) as any).c)
  const count = (sql: string) => (ctx.db.prepare(sql).get(o) as any).c as number
  const spendBySupplierThisMonth = (ctx.db.prepare(`SELECT s.name, SUM(i.total_cents) AS total_cents FROM invoices i JOIN suppliers s ON s.id = i.supplier_id
                                                    WHERE i.org_id = ? AND substr(i.invoice_date, 1, 7) = ? GROUP BY s.id ORDER BY total_cents DESC LIMIT 8`).all(o, thisMonth) as any[])
    .map(r => ({ name: r.name, total: fromCents(r.total_cents) }))
  return {
    spendMonthly, topSuppliers, spendBySupplierThisMonth,
    invoiceStats: { total: inv.total, paid: inv.paid ?? 0, pending: inv.pending ?? 0, pendingAmount: fromCents(inv.pending_cents), totalAmount: fromCents(inv.total_cents) },
    kpis: {
      spendThisMonth: sumMonth(thisMonth), spendLastMonth: sumMonth(lastMonth),
      ingredientsWithoutCost: count('SELECT COUNT(*) AS c FROM ingredients WHERE org_id = ? AND active = 1 AND (cost IS NULL OR cost = 0)'),
      ingredients: count('SELECT COUNT(*) AS c FROM ingredients WHERE org_id = ? AND active = 1'),
      suppliers: count('SELECT COUNT(*) AS c FROM suppliers WHERE org_id = ? AND active = 1'),
      activeRecipes: count('SELECT COUNT(*) AS c FROM recipes WHERE org_id = ? AND active = 1'),
    },
  }
}

export interface PriceDeviation {
  ingredientId: number; name: string; unit: string; current: number; previous: number; supplier: string | null; observedOn: string
  changePct: number; deltaEur: number; monthlyImpact: number | null; observations: number; level: 'high' | 'medium' | 'low'
}

/** Último precio frente al anterior de cada ingrediente, con impacto sobre el gasto mensual. */
export function priceDeviations(ctx: Ctx, ref = today(), minPct = 3) {
  const o = ctx.orgId
  const rows = ctx.db.prepare(`SELECT p.ingredient_id, p.supplier_id, i.name, i.base_unit, p.unit_price, p.observed_on, s.name AS supplier
                               FROM price_observations p JOIN ingredients i ON i.id = p.ingredient_id LEFT JOIN suppliers s ON s.id = p.supplier_id
                               WHERE p.org_id = ? AND p.ingredient_id IS NOT NULL ORDER BY p.ingredient_id, p.observed_on DESC, p.id DESC`).all(o) as any[]
  // Último precio frente al anterior DEL MISMO PROVEEDOR: comparar Makro con la
  // lonja no es una subida, es un diferencial (eso va en inconsistencies).
  const byKey = new Map<string, any[]>()
  for (const r of rows) { const k = `${r.ingredient_id}|${r.supplier_id ?? 0}`; (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(r) }

  const thisMonth = month(ref), lastMonth = prevMonth(thisMonth)
  const spend = new Map<number, { cur: number; prev: number }>()
  for (const r of ctx.db.prepare(`SELECT l.ingredient_id, substr(d.delivery_date, 1, 7) AS m, SUM(l.line_total_cents) AS c FROM delivery_note_lines l JOIN delivery_notes d ON d.id = l.delivery_note_id
                                   WHERE l.org_id = ? AND l.ingredient_id IS NOT NULL AND d.status IN ('validated','invoiced') AND substr(d.delivery_date, 1, 7) IN (?, ?) GROUP BY l.ingredient_id, m`).all(o, thisMonth, lastMonth) as any[]) {
    const s = spend.get(r.ingredient_id) ?? { cur: 0, prev: 0 }
    if (r.m === thisMonth) s.cur = fromCents(r.c); else s.prev = fromCents(r.c)
    spend.set(r.ingredient_id, s)
  }

  const best = new Map<number, PriceDeviation>()
  byKey.forEach(obs => {
    if (obs.length < 2) return
    const [last, prev] = obs
    const ingredientId = last.ingredient_id as number
    if (!(prev.unit_price > 0)) return
    const changePct = Math.round(((last.unit_price - prev.unit_price) / prev.unit_price) * 100)
    if (Math.abs(changePct) < minPct) return
    const sp = spend.get(ingredientId)
    const base = sp?.cur || sp?.prev || 0
    const dev: PriceDeviation = {
      ingredientId, name: last.name, unit: last.base_unit, current: last.unit_price, previous: prev.unit_price, supplier: last.supplier, observedOn: last.observed_on,
      changePct, deltaEur: round2(last.unit_price - prev.unit_price), monthlyImpact: base > 0 ? Math.round((changePct / 100) * base) : null, observations: obs.length,
      level: Math.abs(changePct) >= 15 ? 'high' : Math.abs(changePct) >= 8 ? 'medium' : 'low',
    }
    // Un ingrediente, una fila: la variación más reciente.
    const cur = best.get(ingredientId)
    if (!cur || dev.observedOn > cur.observedOn) best.set(ingredientId, dev)
  })
  const deviations = Array.from(best.values())
  deviations.sort((a, b) => Math.abs(b.monthlyImpact ?? b.changePct) - Math.abs(a.monthlyImpact ?? a.changePct))

  // Mismo ingrediente a precios distintos según proveedor, en unidad base.
  const lines = ctx.db.prepare(`SELECT l.ingredient_id, i.name, i.base_unit, s.name AS supplier, l.unit, l.unit_price, d.delivery_date
                                FROM delivery_note_lines l JOIN delivery_notes d ON d.id = l.delivery_note_id JOIN suppliers s ON s.id = d.supplier_id JOIN ingredients i ON i.id = l.ingredient_id
                                WHERE l.org_id = ? AND l.unit_price > 0 AND l.unit IS NOT NULL ORDER BY l.ingredient_id, d.delivery_date DESC, l.id DESC`).all(o) as any[]
  const latest = new Map<number, Map<string, { supplier: string; price: number; pricePerBase: number; unit: string; date: string }>>()
  for (const l of lines) {
    const u = parseUnit(l.unit); if (!u) continue
    const base = baseUnitOf(u)
    if (base !== baseUnitOf(l.base_unit)) continue
    const m = latest.get(l.ingredient_id) ?? latest.set(l.ingredient_id, new Map()).get(l.ingredient_id)!
    if (!m.has(l.supplier)) m.set(l.supplier, { supplier: l.supplier, price: l.unit_price, pricePerBase: round2(l.unit_price / conversionFactor(u, base) * 1) , unit: l.unit, date: l.delivery_date })
  }
  const inconsistencies: { ingredientId: number; name: string; baseUnit: string; suppliers: { supplier: string; price: number; pricePerBase: number; unit: string; date: string }[]; diffPct: number; potentialSaving: number }[] = []
  latest.forEach((m, ingredientId) => {
    if (m.size < 2) return
    const sup = Array.from(m.values())
    const prices = sup.map(s => s.pricePerBase)
    const min = Math.min(...prices), max = Math.max(...prices)
    if (!(min > 0)) return
    const diffPct = Math.round(((max - min) / min) * 100)
    if (diffPct < 10) return
    const l = lines.find(x => x.ingredient_id === ingredientId)
    inconsistencies.push({ ingredientId, name: l.name, baseUnit: baseUnitOf(l.base_unit), suppliers: sup, diffPct, potentialSaving: round2(max - min) })
  })
  inconsistencies.sort((a, b) => b.diffPct - a.diffPct)

  // Gasto por proveedor, mes actual frente al anterior (albaranes validados).
  const supplierTrend = (ctx.db.prepare(`SELECT s.id, s.name,
      COALESCE(SUM(CASE WHEN substr(d.delivery_date, 1, 7) = ? THEN d.total_cents END), 0) AS cur,
      COALESCE(SUM(CASE WHEN substr(d.delivery_date, 1, 7) = ? THEN d.total_cents END), 0) AS prev
      FROM delivery_notes d JOIN suppliers s ON s.id = d.supplier_id WHERE d.org_id = ? AND d.status IN ('validated','invoiced') GROUP BY s.id`).all(thisMonth, lastMonth, o) as any[])
    .filter(r => r.cur > 0 && r.prev > 0)
    .map(r => ({ id: r.id, name: r.name, thisMonth: fromCents(r.cur), lastMonth: fromCents(r.prev), changePct: Math.round(((r.cur - r.prev) / r.prev) * 100), changeEur: fromCents(r.cur - r.prev) }))
    .filter(r => Math.abs(r.changePct) >= 5)
    .sort((a, b) => Math.abs(b.changeEur) - Math.abs(a.changeEur))

  return { deviations, inconsistencies, supplierTrend }
}

/** Consumo teórico del mes (producción × escandallo explotado) frente a compras recibidas, en unidad base. */
export function consumption(ctx: Ctx, ym = month(today())) {
  const o = ctx.orgId
  const produced = ctx.db.prepare(`SELECT recipe_id, description, SUM(portions) AS portions, COUNT(*) AS records FROM production_records
                                   WHERE org_id = ? AND recipe_id IS NOT NULL AND substr(produced_on, 1, 7) = ? GROUP BY recipe_id`).all(o, ym) as any[]
  const refs = _refs(ctx)
  const costs = recipeCosts(ctx)
  const theoretical = new Map<number, { ingredientId: number; name: string; qty: number; unit: string }>()
  const byRecipe: { recipeId: number; name: string; portions: number; foodCostPct: number | null; items: { ingredientId: number | null; name: string; qty: number; unit: string }[] }[] = []
  for (const p of produced) {
    const r = refs.recipes.find(x => x.id === p.recipe_id); if (!r) continue
    const items = explodeIngredients(r.id, refs.recipes, refs.lines, refs.ingredients, p.portions / (r.portions || 1))
    byRecipe.push({ recipeId: r.id, name: r.name, portions: p.portions, foodCostPct: costs.get(r.id)?.foodCostPct ?? null, items })
    for (const it of items) {
      if (it.ingredientId == null) continue
      const cur = theoretical.get(it.ingredientId)
      if (cur) cur.qty += it.qty; else theoretical.set(it.ingredientId, { ingredientId: it.ingredientId, name: it.name, qty: it.qty, unit: it.unit })
    }
  }
  const purchased = new Map<number, { qty: number; cost: number }>()
  for (const l of ctx.db.prepare(`SELECT l.ingredient_id, l.qty, l.unit, l.line_total_cents, i.base_unit FROM delivery_note_lines l JOIN delivery_notes d ON d.id = l.delivery_note_id JOIN ingredients i ON i.id = l.ingredient_id
                                   WHERE l.org_id = ? AND d.status IN ('validated','invoiced') AND substr(d.delivery_date, 1, 7) = ? AND l.qty IS NOT NULL AND l.unit IS NOT NULL`).all(o, ym) as any[]) {
    const u = parseUnit(l.unit); if (!u || baseUnitOf(u) !== l.base_unit) continue
    const cur = purchased.get(l.ingredient_id) ?? { qty: 0, cost: 0 }
    cur.qty += l.qty * conversionFactor(u, l.base_unit); cur.cost += fromCents(l.line_total_cents ?? 0)
    purchased.set(l.ingredient_id, cur)
  }
  const comparison = Array.from(theoretical.values()).map(t => {
    const p = purchased.get(t.ingredientId)
    return { ingredientId: t.ingredientId, name: t.name, unit: t.unit, theoretical: round2(t.qty), purchased: p ? round2(p.qty) : null,
             difference: p ? round2(p.qty - t.qty) : null, purchasedCost: p ? round2(p.cost) : null,
             note: p ? null : 'Sin compras recibidas de este ingrediente en el mes' }
  }).sort((a, b) => Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0))
  return { month: ym, byRecipe, comparison, hasProduction: produced.length > 0, hasPurchases: purchased.size > 0 }
}

export function spendBetween(ctx: Ctx, from: string, to: string): number {
  return fromCents((ctx.db.prepare('SELECT COALESCE(SUM(total_cents), 0) AS c FROM invoices WHERE org_id = ? AND invoice_date BETWEEN ? AND ?').get(ctx.orgId, from, to) as any).c)
}

export { addDays }
