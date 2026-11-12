// Asistente de cocina: un bucle de agente sobre OpenAI cuyas herramientas
// llaman a los servicios (nunca a SQL de negocio). Las tarjetas conservan
// el protocolo de prefijos que entiende KitchenChat.
import type { Llm, LlmMessage } from '@/server/adapters/openai'
import { addDays, parseDate, today } from '@/server/domain/dates'
import { foodCostLevel } from '@/server/domain/costing'
import { fromCents, round2, round4 } from '@/server/domain/money'
import { matchByName, norm } from '@/server/domain/text'
import { baseUnitOf, compatible, conversionFactor, parseUnit } from '@/server/domain/units'
import type { Ctx } from '@/server/http/context'
import { computeAlerts } from '../alerts'
import { dashboard, priceDeviations } from '../analytics'
import { createIngredient, createSupplier, ensureSupplier, listIngredients, listSuppliers, priceHistory, recordPrice, updateIngredient } from '../catalog'
import { commitDocument, mapExtracted } from '../documents'
import { createInvoice, createOrder, getOrder, listDeliveryNotes, listInvoices, listOrders, setInvoicePaid } from '../purchasing'
import { criticalRecipes, ingredientsToConsume, listRecipes, recipeCosts, registerProduction, _refs } from '../recipes'
import { listWaste, registerWaste, wasteInPeriod } from '../waste'
import { NAV_ROUTES, TERMINAL_CARDS, TOOLS, suggestionsFor } from './tools'

const card = (prefix: string, data: unknown) => `${prefix}${JSON.stringify(data)}`
const eur = (n: number) => `${round2(n)}€`

function period(p: string | undefined, ref = today()): { from: string; to: string } {
  const ym = ref.slice(0, 7)
  const [y, m] = ym.split('-').map(Number)
  const lastMonthStart = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`
  switch (p) {
    case 'hoy': return { from: ref, to: ref }
    case 'esta_semana': return { from: addDays(ref, -7), to: ref }
    case 'mes_anterior': return { from: lastMonthStart, to: addDays(`${ym}-01`, -1) }
    case 'este_año': return { from: `${ref.slice(0, 4)}-01-01`, to: ref }
    case 'todo': return { from: '1970-01-01', to: ref }
    default: return { from: `${ym}-01`, to: ref }
  }
}

function findIngredient(ctx: Ctx, name: string | undefined) {
  if (!name) return null
  return matchByName(name, listIngredients(ctx))?.item ?? null
}
function findRecipe(ctx: Ctx, name: string | undefined) {
  if (!name) return null
  return matchByName(name, listRecipes(ctx))?.item ?? null
}
function findSupplierByName(ctx: Ctx, name: string | undefined) {
  if (!name) return null
  return matchByName(name, listSuppliers(ctx))?.item ?? null
}

export async function executeTool(ctx: Ctx, name: string, a: any): Promise<string> {
  switch (name) {
    case 'navegar': {
      const key = String(a.ruta || '').toLowerCase().trim().replace(/^\/+/, '').replace(/^dashboard\/?/, '')
      return card('__NAVIGATE__', { path: NAV_ROUTES[key] || '/dashboard', label: a.etiqueta || key || 'Inicio' })
    }
    case 'buscar_ingrediente': {
      let rows = listIngredients(ctx)
      if (a.nombre) rows = rows.filter(i => norm(i.name).includes(norm(a.nombre)))
      if (a.tipo) rows = rows.filter(i => norm(i.category ?? '').includes(norm(a.tipo)))
      if (a.sin_coste) rows = rows.filter(i => !i.cost)
      if (!rows.length) return 'No se encontraron ingredientes.'
      return card('__INGREDIENTES_CARDS__', { ingredientes: rows.slice(0, 30).map(i => ({ id: i.id, descr: i.name, type: i.category, unit: i.base_unit, cost: i.cost })), filtro: a.nombre || a.tipo || (a.sin_coste ? 'sin coste' : '') })
    }
    case 'crear_ingrediente': {
      const i = createIngredient(ctx, { name: a.descr, category: a.type ?? null, baseUnit: a.unit || 'ud', cost: a.cost ?? null })
      return `Creado ${i.name} (id ${i.id}) en ${i.base_unit}${i.cost != null ? ` a ${eur(i.cost)}` : ''}.`
    }
    case 'actualizar_ingrediente': {
      const ing = a.id ? listIngredients(ctx).find(i => i.id === Number(a.id)) ?? null : findIngredient(ctx, a.nombre)
      if (!ing) return `No encontré el ingrediente "${a.nombre ?? a.id}".`
      const patch: any = {}
      if (a.cost !== undefined) patch.cost = a.cost
      if (a.unit !== undefined) patch.baseUnit = a.unit
      if (a.type !== undefined) patch.category = a.type
      if (!Object.keys(patch).length) return 'No se indicó ningún campo a actualizar.'
      const u = updateIngredient(ctx, ing.id, patch)
      return `${u.name} actualizado: ${u.cost != null ? eur(u.cost) + '/' : ''}${u.base_unit}.`
    }
    case 'top_ingredientes_coste': {
      const rows = listIngredients(ctx).filter(i => (i.cost ?? 0) > 0).sort((x, y) => a.orden === 'mas_barato' ? x.cost! - y.cost! : y.cost! - x.cost!).slice(0, a.n || 10)
      if (!rows.length) return 'No hay ingredientes con coste registrado.'
      return card('__CHART__', { chart: { tipo: 'bar', titulo: a.orden === 'mas_barato' ? 'Ingredientes más baratos' : 'Ingredientes más caros', datos: rows.slice(0, 8).map(r => ({ label: r.name, value: r.cost })), unidad: '€' },
                                 text: rows.map((r, i) => `${i + 1}. ${r.name} — ${r.cost}€/${r.base_unit}`).join('\n') })
    }
    case 'buscar_proveedor': {
      let rows = listSuppliers(ctx)
      if (a.nombre) rows = rows.filter(s => norm(s.name).includes(norm(a.nombre)))
      if (!rows.length) return 'No se encontraron proveedores.'
      return card('__PROVEEDORES_CARDS__', { proveedores: rows.slice(0, 20).map(s => ({ id: s.id, descr: s.name, nif: s.tax_id, mail: s.email, phone: s.phone, canal_preferido: s.preferred_channel })) })
    }
    case 'crear_proveedor': {
      const s = createSupplier(ctx, { name: a.descr, taxId: a.nif ?? null, email: a.mail ?? null, phone: a.phone ?? null })
      return `Proveedor ${s.name} creado (id ${s.id}).`
    }
    case 'ver_albaranes_recientes': {
      let rows = listDeliveryNotes(ctx)
      if (a.proveedor) rows = rows.filter(d => norm(d.supplier_name).includes(norm(a.proveedor)))
      rows = rows.slice(0, a.n || 10)
      if (!rows.length) return 'No hay albaranes registrados.'
      return rows.map(d => `• ${d.number} | ${d.supplier_name} | ${d.delivery_date} | ${d.status} | Base ${eur(fromCents(d.base_cents))} | Total ${eur(fromCents(d.total_cents))}`).join('\n')
    }
    case 'guardar_albaran_completo': {
      const scan = mapExtracted(ctx, 'delivery_note', { vendor: a.vendor, vendor_nif: a.nif, doc_num: a.delivery_num, fecha: a.date_delivery, base: a.base, iva: a.taxes, total: a.total, lineas: a.lineas })
      const r = commitDocument(ctx, {
        kind: 'delivery_note', createSupplier: true, applyPrices: true, force: scan.header.base == null,
        header: { supplierId: scan.header.supplierId, vendor: scan.header.vendor, vendorTaxId: scan.header.vendorTaxId, number: scan.header.number, date: scan.header.date, base: scan.header.base, vat: scan.header.vat, total: scan.header.total },
        lines: scan.lines.map(l => ({ description: l.description, qty: l.qty, unit: l.unitRecognized ? l.unit : null, unitPrice: l.unitPrice, lineTotal: l.lineTotal, vatRate: l.vatRate, ingredientId: l.ingredientId, create: l.ingredientId ? null : {} })),
      })
      const v = r.validation
      const affected = new Set((v?.affectedRecipes ?? []).map(x => x.name))
      return card('__ALBARAN_GUARDADO__', {
        albaran_id: r.deliveryNoteId, estado: r.status, vendor: a.vendor, delivery_num: r.number, date_delivery: scan.header.date ?? today(), base: a.base ?? null, taxes: a.taxes ?? null, total: a.total ?? null,
        lineas: a.lineas || [], ingredientes_creados: r.ingredientsCreated,
        price_changes: (v?.priceChanges ?? []).map(p => ({ nombre: p.name, precio_anterior: p.previous, precio_nuevo: p.current, diff_pct: p.changedPct, recetas_afectadas: Array.from(affected) })),
        food_cost_impact: foodCostImpact(ctx, (v?.affectedRecipes ?? []).map(x => x.id)),
      })
    }
    case 'guardar_factura_compra': {
      const sup = ensureSupplier(ctx, { name: a.vendor, taxId: a.nif ?? null })
      const inv = createInvoice(ctx, { supplierId: sup.id, number: a.invoice_num, invoiceDate: a.date_invoice || today(), dueDate: a.date_due ?? null, base: a.base ?? null, vat: a.taxes ?? null, total: a.total ?? null })
      return `Factura ${inv.number} de ${sup.name} guardada: ${eur(fromCents(inv.total_cents))}${inv.due_date ? `, vence el ${inv.due_date}` : ''}.`
    }
    case 'crear_pedido': {
      const sup = findSupplierByName(ctx, a.vendor)
      if (!sup) return `No encontré el proveedor "${a.vendor}". Crea el proveedor primero.`
      const ingredients = listIngredients(ctx)
      const o = createOrder(ctx, { supplierId: sup.id, expectedDate: a.fecha_entrega ?? null, lines: (a.lineas || []).map((l: any) => ({ ingredientId: matchByName(l.nombre, ingredients)?.item.id ?? null, description: l.nombre, qty: l.cantidad || 1, unit: parseUnit(l.unidad) ?? 'ud' })) })
      return `Pedido ${o.number} a ${sup.name} creado en borrador con ${o.lines.length} líneas.`
    }
    case 'resumen_gastos': {
      const { from, to } = period(a.periodo)
      const inv = listInvoices(ctx).filter(i => i.invoice_date >= from && i.invoice_date <= to)
      const pending = listInvoices(ctx, { status: 'pending' })
      return `Periodo: ${a.periodo || 'este_mes'} (${from} a ${to})\nFacturas: ${inv.length} | Gasto: ${eur(inv.reduce((s, i) => s + fromCents(i.total_cents), 0))}\nFacturas pendientes: ${pending.length} (${eur(pending.reduce((s, i) => s + fromCents(i.total_cents), 0))})`
    }
    case 'gasto_por_proveedor': {
      const { from, to } = period(a.periodo || 'todo')
      const by = new Map<string, { total: number; n: number }>()
      for (const i of listInvoices(ctx).filter(i => i.invoice_date >= from && i.invoice_date <= to)) {
        const cur = by.get(i.supplier_name) ?? { total: 0, n: 0 }; cur.total += fromCents(i.total_cents); cur.n++; by.set(i.supplier_name, cur)
      }
      const rows = Array.from(by.entries()).sort((x, y) => y[1].total - x[1].total).slice(0, a.top || 10)
      if (!rows.length) return 'No hay facturas en ese periodo.'
      return card('__CHART__', { chart: { tipo: 'bar', titulo: `Gasto por proveedor · ${(a.periodo || 'histórico').replace(/_/g, ' ')}`, datos: rows.slice(0, 8).map(([label, v]) => ({ label, value: round2(v.total) })), unidad: '€' },
                                 text: rows.map(([n, v], i) => `${i + 1}. ${n} — ${eur(v.total)} (${v.n} facturas)`).join('\n') })
    }
    case 'informe_diario': return card('__BRIEF_CARDS__', dailyCards(ctx))
    case 'pedidos_pendientes_recibir': {
      const orders = listOrders(ctx, { status: 'sent' }).slice(0, 20)
      if (!orders.length) return 'No hay pedidos pendientes de recibir.'
      return card('__PEDIDOS_RECIBIR_CARDS__', { pedidos: orders.map(o => { const full = getOrder(ctx, o.id); return { id: o.id, descr: `${o.number} · ${o.supplier_name}`, mes: o.order_date.slice(0, 7), lineas: full.lines.slice(0, 6).map(l => ({ nombre: l.description, cantidad: l.qty, unidad: l.unit })), total_lineas: full.lines.length } }) })
    }
    case 'alertas_subida_precio': {
      const umbral = a.umbral_pct || 10
      const subidas = priceDeviations(ctx, today(), umbral).deviations.filter(d => d.changePct >= umbral).map(d => ({ nombre: d.name, precio_anterior: d.previous, precio_actual: d.current, diff_pct: d.changePct, vendor: d.supplier, fecha: d.observedOn, unidad: d.unit }))
      if (!subidas.length) return `No hay ingredientes con subidas de precio superiores al ${umbral}%.`
      return card('__PRECIOS_ALERTA_CARDS__', { subidas, umbral_pct: umbral })
    }
    case 'alertas_predictivas': return predictive(ctx)
    case 'registrar_merma': {
      const ing = findIngredient(ctx, a.nombre)
      const rec = ing ? null : findRecipe(ctx, a.nombre)
      const w = registerWaste(ctx, { ingredientId: ing?.id ?? null, recipeId: rec?.id ?? null, description: a.nombre, qty: a.cantidad, unit: rec ? 'ud' : a.unidad, reason: a.motivo ?? 'otro', estimatedCost: a.coste_estimado ?? null, occurredOn: a.fecha ?? null, notes: a.notas ?? null })
      return `Merma registrada (id ${w.id}): ${w.description} · ${w.qty} ${w.unit}${w.estimated_cost != null ? ' · ' + eur(w.estimated_cost) : ''}${!ing && !rec ? ' (sin enlazar a catálogo)' : ''}`
    }
    case 'ver_merma': {
      const { from, to } = period(a.periodo || 'este_mes')
      let rows = listWaste(ctx, { from, to, limit: 50 })
      if (a.motivo) rows = rows.filter(r => norm(r.reason ?? '').includes(norm(a.motivo)))
      if (!rows.length) return `No hay merma registrada para ${a.periodo || 'este mes'}.`
      const total = round2(rows.reduce((s, r) => s + (r.estimated_cost ?? 0), 0))
      const text = `Merma ${a.periodo || 'este mes'} — Total: ${eur(total)}\n` + rows.slice(0, 20).map(r => `• ${r.description} | ${r.qty} ${r.unit} | ${r.reason ?? '-'} | ${r.estimated_cost != null ? eur(r.estimated_cost) : '-'} | ${r.occurred_on}`).join('\n')
      const by = new Map<string, number>()
      for (const r of rows) by.set(r.description, (by.get(r.description) ?? 0) + (r.estimated_cost ?? 0))
      const datos = Array.from(by.entries()).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([label, value]) => ({ label, value: round2(value) }))
      return datos.length > 1 ? card('__CHART__', { chart: { tipo: 'bar', titulo: `Merma por producto · ${a.periodo || 'este mes'}`, datos, unidad: '€' }, text }) : text
    }
    case 'registrar_precio': {
      const ing = findIngredient(ctx, a.nombre)
      if (!ing) return `No encontré el ingrediente "${a.nombre}". Créalo primero.`
      const u = parseUnit(a.unidad) ?? ing.base_unit
      if (!compatible(u, ing.base_unit)) return `"${ing.name}" se mide en ${ing.base_unit}, no en ${u}.`
      const sup = findSupplierByName(ctx, a.vendor)
      const price = round4(Number(a.precio) / conversionFactor(u, ing.base_unit))
      const r = recordPrice(ctx, { ingredientId: ing.id, supplierId: sup?.id ?? null, unitPrice: price, observedOn: today(), sourceType: 'manual', applyToIngredient: true })
      const affected = recipesUsing(ctx, ing.id)
      return `Precio registrado: ${ing.name} → ${eur(price)}/${ing.base_unit}${sup ? ` (${sup.name})` : ''}${r.changedPct != null ? ` (${r.changedPct > 0 ? '+' : ''}${r.changedPct}%)` : ''}${foodCostImpact(ctx, affected)}`
    }
    case 'registrar_produccion': {
      const rec = findRecipe(ctx, a.nombre)
      if (!rec) return `No encontré la receta "${a.nombre}".`
      registerProduction(ctx, { recipeId: rec.id, portions: Math.max(1, Math.round(a.raciones || 1)), producedOn: a.fecha ?? null })
      return `Producción registrada: ${rec.name} × ${a.raciones || 1} raciones.`
    }
    case 'informe_semanal': return card('__INFORME_SEMANAL__', weekly(ctx))
    case 'listar_facturas_para_pagar': {
      const ref = today()
      const facturas = listInvoices(ctx, { status: 'pending' }).slice(0, 40).map(f => ({ id: f.id, invoice_num: f.number, vendor: f.supplier_name, total: fromCents(f.total_cents), base: fromCents(f.base_cents), taxes: fromCents(f.vat_cents),
        date_due: f.due_date, date_invoice: f.invoice_date, vencida: !!f.due_date && f.due_date < ref, dias_vencida: f.due_date ? Math.floor((Date.parse(ref) - Date.parse(f.due_date)) / 86400000) : null }))
      return card('__FACTURAS_PAGAR__', { facturas })
    }
    case 'marcar_factura_pagada': {
      let rows = listInvoices(ctx, { status: 'pending' })
      if (!a.todas) {
        if (!a.vendor && !a.invoice_num) return 'Necesito al menos el proveedor o el número de factura.'
        if (a.vendor) rows = rows.filter(f => norm(f.supplier_name).includes(norm(a.vendor)))
        if (a.invoice_num) rows = rows.filter(f => norm(f.number) === norm(a.invoice_num))
      }
      if (!rows.length) return 'No encontré facturas pendientes con esos criterios.'
      for (const f of rows) setInvoicePaid(ctx, f.id, true)
      return `${rows.length} factura${rows.length > 1 ? 's' : ''} marcada${rows.length > 1 ? 's' : ''} como pagada${rows.length > 1 ? 's' : ''}: ${rows.map(f => f.number).join(', ')}.`
    }
    case 'comparar_precios_proveedor': {
      const inc = priceDeviations(ctx).inconsistencies
      if (a.nombre) {
        const one = inc.find(i => norm(i.name).includes(norm(a.nombre)))
        if (!one) return `Solo hay un proveedor con precio registrado para "${a.nombre}" (o ninguno). Hacen falta dos o más para comparar.`
        const sorted = [...one.suppliers].sort((x, y) => x.pricePerBase - y.pricePerBase)
        return card('__CHART__', { chart: { tipo: 'bar', titulo: `Precio de ${one.name} por proveedor (€/${one.baseUnit})`, datos: sorted.map(s => ({ label: s.supplier, value: s.pricePerBase })), unidad: `€/${one.baseUnit}` },
          text: `Comparativa de ${one.name}:\n` + sorted.map((s, i) => `${i + 1}. ${s.supplier}: ${s.pricePerBase}€/${one.baseUnit} (${s.date})`).join('\n') + `\n\nMás barato: ${sorted[0].supplier}. Diferencia: ${one.diffPct}%` })
      }
      if (!inc.length) return 'No hay ingredientes comprados a dos o más proveedores con unidades comparables.'
      return 'Top oportunidades de ahorro por proveedor:\n\n' + inc.slice(0, a.top || 8).map(i => { const s = [...i.suppliers].sort((x, y) => x.pricePerBase - y.pricePerBase); return `• ${i.name}: ${s.map(v => `${v.supplier} ${v.pricePerBase}€`).join(' · ')} → ${s[0].supplier} es ${i.diffPct}% más barato` }).join('\n')
    }
    case 'analizar_food_cost_recetas': {
      const umbral = a.umbral_pct || 33
      const recetas = Array.from(recipeCosts(ctx).values()).filter(c => c.kind === 'dish' && (c.salePrice ?? 0) > 0 && c.foodCostPct != null)
        .map(c => ({ id: c.recipeId, nombre: c.name, coste: round2(c.perPortion), pvp: c.salePrice, pct: Math.round(c.foodCostPct!), pvSugerido: c.perPortion > 0 ? Math.ceil((c.perPortion / 0.3) * 100) / 100 : null,
                     nivel: ({ critical: 'critico', review: 'revisar', healthy: 'aceptable', excellent: 'excelente' } as any)[foodCostLevel(c.foodCostPct)] ?? 'revisar' }))
        .sort((x, y) => y.pct - x.pct)
      if (!recetas.length) return 'No hay recetas con precio de venta y coste calculable.'
      return card('__FOOD_COST_CARDS__', { recetas, umbral_pct: umbral })
    }
    case 'calcular_compra_semanal': return weeklyPurchase(ctx, a.platos || [])
    case 'historial_precio_ingrediente': {
      const ing = findIngredient(ctx, a.nombre)
      const rows = ing ? priceHistory(ctx, ing.id, 30).reverse() : []
      if (rows.length < 2) return `No hay suficiente historial de precios para "${a.nombre}".`
      const first = rows[0], last = rows[rows.length - 1]
      const change = first.unit_price > 0 ? Math.round(((last.unit_price - first.unit_price) / first.unit_price) * 100) : 0
      return card('__CHART__', { chart: { tipo: 'line', titulo: `Evolución precio · ${ing!.name}`, datos: rows.map(r => ({ label: r.observed_on, value: r.unit_price })), unidad: `€/${ing!.base_unit}` },
        text: `Historial de ${ing!.name}: ${first.unit_price}€ (${first.observed_on}) → ${last.unit_price}€ (${last.observed_on}). Variación ${change > 0 ? '+' : ''}${change}%` })
    }
    case 'selector_pedido': {
      const suppliers = listSuppliers(ctx).map(s => ({ id: s.id, descr: s.name, mail: s.email, phone: s.phone, canal_preferido: s.preferred_channel }))
      const ing = listIngredients(ctx).filter(i => i.supplier_id)
      const by = new Map<number, { proveedor: any; ingredientes: any[] }>()
      for (const i of ing) {
        const p = suppliers.find(s => s.id === i.supplier_id); if (!p) continue
        const g = by.get(p.id) ?? by.set(p.id, { proveedor: p, ingredientes: [] }).get(p.id)!
        g.ingredientes.push({ id: i.id, descr: i.name, unit: i.base_unit, cost: i.cost })
      }
      const pendientes = listOrders(ctx, { status: 'draft' }).slice(0, 10).map(o => ({ id: o.id, descr: `${o.number} · ${o.supplier_name}`, total: o.total }))
      return card('__PEDIDO_SELECTOR__', { pedidosPorProveedor: Array.from(by.values()), pendientes, proveedores: suppliers })
    }
    case 'sugerir_items_pedido': {
      const sup = findSupplierByName(ctx, a.proveedor_nombre)
      if (!sup) return `No encontré el proveedor "${a.proveedor_nombre}".`
      const hist = ctx.db.prepare(`SELECT COALESCE(i.name, l.description) AS nombre, COALESCE(l.unit, i.base_unit) AS unidad, ROUND(AVG(l.qty), 2) AS media, COUNT(*) AS veces, MAX(d.delivery_date) AS ultima
                                   FROM delivery_note_lines l JOIN delivery_notes d ON d.id = l.delivery_note_id LEFT JOIN ingredients i ON i.id = l.ingredient_id
                                   WHERE l.org_id = ? AND d.supplier_id = ? AND d.status IN ('validated','invoiced') GROUP BY nombre, unidad ORDER BY veces DESC, ultima DESC LIMIT 15`).all(ctx.orgId, sup.id) as any[]
      const seen = new Set(hist.map(h => norm(h.nombre)))
      const assigned = listIngredients(ctx).filter(i => i.supplier_id === sup.id && !seen.has(norm(i.name)))
      if (!hist.length && !assigned.length) return `No tengo datos de compras previas ni ingredientes asignados a "${sup.name}". Pregunta al usuario qué quiere pedir.`
      return `Artículos sugeridos para ${sup.name} (histórico real):\n` + [...hist.map(h => `• ${h.nombre} — ${h.media ?? '?'} ${h.unidad || 'ud'} [histórico ${h.veces}x, última ${h.ultima}]`), ...assigned.map(i => `• ${i.name} — ? ${i.base_unit} [asignado, sin histórico]`)].join('\n') + '\n\nUSA ESTOS NOMBRES EXACTOS al proponer el pedido.'
    }
    case 'analizar_necesidades_pedido': {
      const fresh = new Set(['pescado', 'marisco', 'carne', 'verdura', 'hongo', 'lacteo', 'fruta', 'hierba', 'charcuteria', 'panaderia'])
      const rows = ctx.db.prepare(`SELECT i.id, i.name, i.base_unit, i.category, s.id AS sid, s.name AS sname, s.email, s.phone,
          (SELECT MAX(d.delivery_date) FROM delivery_note_lines l JOIN delivery_notes d ON d.id = l.delivery_note_id WHERE l.ingredient_id = i.id AND d.status IN ('validated','invoiced')) AS last,
          (SELECT ROUND(AVG(l.qty), 2) FROM delivery_note_lines l JOIN delivery_notes d ON d.id = l.delivery_note_id WHERE l.ingredient_id = i.id AND d.status IN ('validated','invoiced')) AS avg_qty
          FROM ingredients i JOIN suppliers s ON s.id = i.supplier_id WHERE i.org_id = ? AND i.active = 1 ORDER BY s.name, i.name`).all(ctx.orgId) as any[]
      const refMs = Date.parse(today())
      const groups = new Map<number, { proveedor: any; items: any[] }>()
      for (const r of rows) {
        const threshold = fresh.has(norm(r.category ?? '')) ? 7 : 30
        const days = r.last ? Math.floor((refMs - Date.parse(r.last)) / 86400000) : 999
        if (days < threshold) continue
        const g = groups.get(r.sid) ?? groups.set(r.sid, { proveedor: { id: r.sid, nombre: r.sname, email: r.email, phone: r.phone }, items: [] }).get(r.sid)!
        g.items.push({ id: r.id, nombre: r.name, cantidad: r.avg_qty || 1, unidad: r.base_unit, dias_sin_pedir: days === 999 ? 'nunca' : days })
      }
      if (!groups.size) return 'Todos los ingredientes están dentro de su ciclo de pedido habitual. No hace falta reponer nada urgente.'
      return card('__NECESIDADES_PEDIDO__', { grupos: Array.from(groups.values()) })
    }
    case 'proponer_pedido_whatsapp':
    case 'proponer_pedido_email': {
      const sup = findSupplierByName(ctx, a.proveedor_nombre)
      const date = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const items = (a.items || []) as { nombre: string; cantidad?: number; unidad?: string }[]
      const lines = items.map(i => `• ${i.nombre}${i.cantidad ? ': ' + i.cantidad + (i.unidad ? ' ' + i.unidad : '') : ''}`).join('\n')
      if (name === 'proponer_pedido_whatsapp') {
        return card('__WHATSAPP_PROPOSAL__', { proveedor: sup?.name ?? a.proveedor_nombre, proveedor_id: sup?.id ?? null, phone: a.proveedor_phone || sup?.phone || '', items,
          message: `Hola, pedido para el ${date}:\n\n${lines}${a.notas ? '\n\n' + a.notas : ''}\n\nMuchas gracias` })
      }
      return card('__EMAIL_PROPOSAL__', { proveedor: sup?.name ?? a.proveedor_nombre, proveedor_id: sup?.id ?? null, to: a.proveedor_email || sup?.email || '', subject: `Pedido ${date}`, items,
        body: `Estimado equipo de ${sup?.name ?? a.proveedor_nombre},\n\nNecesitamos el siguiente pedido para la próxima entrega:\n\n${lines}\n${a.notas ? '\nNotas: ' + a.notas + '\n' : ''}\nPor favor, confirmad disponibilidad y fecha de entrega.\n\nMuchas gracias` })
    }
    default: return 'Herramienta no reconocida'
  }
}

function recipesUsing(ctx: Ctx, ingredientId: number): number[] {
  return (ctx.db.prepare('SELECT DISTINCT recipe_id FROM recipe_lines WHERE org_id = ? AND ingredient_id = ?').all(ctx.orgId, ingredientId) as { recipe_id: number }[]).map(r => r.recipe_id)
}

/** Recetas afectadas con food cost en zona de revisión o crítica. */
function foodCostImpact(ctx: Ctx, recipeIds: number[]): string {
  if (!recipeIds.length) return ''
  const costs = recipeCosts(ctx)
  const rows = recipeIds.map(id => costs.get(id)).filter((c): c is NonNullable<typeof c> => !!c && c.foodCostPct != null && c.foodCostPct > 30).sort((x, y) => y.foodCostPct! - x.foodCostPct!)
  if (!rows.length) return ''
  return '\n\nIMPACTO EN FOOD COST:\n' + rows.map(c => `• ${c.name}: ${Math.round(c.foodCostPct!)}% [${c.foodCostPct! > 35 ? 'CRITICO' : 'REVISAR'}]`).join('\n')
}

function dailyCards(ctx: Ctx) {
  const ref = today()
  const h = new Date().getHours()
  const d = dashboard(ctx, ref)
  const alerts = computeAlerts(ctx, ref)
  const byId = (id: string) => alerts.find(a => a.id === id)
  const variation = d.kpis.spendLastMonth > 0 ? Math.round(((d.kpis.spendThisMonth - d.kpis.spendLastMonth) / d.kpis.spendLastMonth) * 100) : null
  const waste = wasteInPeriod(ctx, `${ref.slice(0, 7)}-01`, ref)
  const cards: any[] = [{
    id: 'gastos', titulo: 'Gasto compras', icon: 'chart', urgencia: variation != null && variation > 15 ? 'warning' : 'normal',
    items: [`Este mes: **${eur(d.kpis.spendThisMonth)}**${variation != null ? ` (${variation > 0 ? '+' : ''}${variation}% vs mes anterior)` : ''}`, ...(d.spendBySupplierThisMonth.length ? d.spendBySupplierThisMonth.slice(0, 3).map(s => `${s.name}: ${eur(s.total)}`) : ['Sin facturas este mes'])],
    acciones: [{ label: 'Ver analytics', href: '/dashboard/analytics' }, { label: 'Desglose por proveedor', chat: 'Dame el gasto por proveedor este mes' }],
  }]
  const toSend = byId('pedidos_envio'), toReceive = byId('pedidos_pendientes')
  if (toSend || toReceive) cards.push({ id: 'pedidos', titulo: 'Pedidos', icon: 'truck', urgencia: toSend ? 'warning' : 'normal', items: [toSend?.titulo, toReceive?.titulo].filter(Boolean),
    acciones: [{ label: 'Ver pedidos', href: '/dashboard/compras/pedidos' }, { label: 'Hacer pedido', chat: 'Quiero hacer un pedido' }] })
  const overdue = byId('facturas_vencidas'), soon = byId('facturas_proximas')
  cards.push({ id: 'facturas', titulo: 'Facturas pendientes', icon: 'invoice', urgencia: overdue ? 'danger' : soon ? 'warning' : 'normal',
    items: [overdue ? `**${overdue.titulo}** · ${overdue.detalle}` : null, soon ? `${soon.titulo} · ${soon.detalle}` : null, `Total pendiente: **${d.invoiceStats.pending} facturas** (${eur(d.invoiceStats.pendingAmount)})`].filter(Boolean),
    acciones: [{ label: 'Ver facturas', href: '/dashboard/compras/facturas' }, { label: 'Pagar facturas', chat: 'Muéstrame las facturas pendientes para pagarlas' }] })
  if (waste.n > 0) cards.push({ id: 'merma', titulo: 'Merma este mes', icon: 'merma', urgencia: waste.cost > 100 ? 'warning' : 'normal', items: [`**${eur(waste.cost)}** en ${waste.n} eventos`],
    acciones: [{ label: 'Ver merma', href: '/dashboard/merma' }, { label: 'Registrar merma', chat: 'Quiero registrar una merma' }] })
  const prices = byId('precios_subida')
  if (prices) cards.push({ id: 'precios', titulo: 'Alertas de precio', icon: 'alert', urgencia: 'warning', items: prices.detalle.split(' · ').map(s => `**${s}**`),
    acciones: [{ label: 'Ver analytics', href: '/dashboard/analytics' }, { label: 'Actualizar precios', chat: 'Ayúdame a actualizar los precios que han subido' }] })
  const fc = byId('food_cost_critico')
  if (fc) cards.push({ id: 'food_cost', titulo: 'Food cost crítico', icon: 'warning', urgencia: 'danger', items: fc.detalle.split(' · '), acciones: [{ label: 'Ver escandallo', href: '/dashboard/sangrado' }, { label: 'Analizar', chat: 'Qué platos tienen el food cost más alto' }] })
  if (d.kpis.ingredientsWithoutCost > 0) cards.push({ id: 'sin_coste', titulo: 'Ingredientes sin coste', icon: 'warning', urgencia: 'warning', items: [`**${d.kpis.ingredientsWithoutCost} ingredientes** sin precio registrado (afecta al escandallo)`],
    acciones: [{ label: 'Ver ingredientes', href: '/dashboard/ingredientes?filtro=sin_coste' }, { label: 'Cuáles son', chat: 'Dime qué ingredientes no tienen coste registrado' }] })
  return { saludo: h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches', fecha: ref, cards }
}

function weekly(ctx: Ctx) {
  const ref = today(), from = addDays(ref, -7), prevFrom = addDays(ref, -14)
  const inv = listInvoices(ctx)
  const sum = (a: string, b: string) => round2(inv.filter(i => i.invoice_date >= a && i.invoice_date <= b).reduce((s, i) => s + fromCents(i.total_cents), 0))
  const week = sum(from, ref), prev = sum(prevFrom, addDays(from, -1))
  const top = new Map<string, number>()
  for (const i of inv.filter(i => i.invoice_date >= from && i.invoice_date <= ref)) top.set(i.supplier_name, (top.get(i.supplier_name) ?? 0) + fromCents(i.total_cents))
  const waste = wasteInPeriod(ctx, from, ref)
  const topWaste = ctx.db.prepare('SELECT description AS nombre, ROUND(SUM(COALESCE(estimated_cost, 0)), 2) AS t FROM waste_records WHERE org_id = ? AND occurred_on BETWEEN ? AND ? GROUP BY description ORDER BY t DESC LIMIT 3').all(ctx.orgId, from, ref)
  const pending = listInvoices(ctx, { status: 'pending' }), overdue = pending.filter(f => f.due_date && f.due_date < ref)
  const dev = priceDeviations(ctx, ref, 5).deviations.filter(d => d.changePct > 5 && d.observedOn >= from).slice(0, 4)
  return {
    fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
    gasto: { total: week, facturas: inv.filter(i => i.invoice_date >= from && i.invoice_date <= ref).length, variacion: prev > 0 ? Math.round(((week - prev) / prev) * 100) : null, top: Array.from(top.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([vendor, t]) => ({ vendor, t: round2(t) })) },
    merma: { total: waste.cost, eventos: waste.n, top: topWaste },
    facturas: { vencidas_c: overdue.length, vencidas_t: round2(overdue.reduce((s, f) => s + fromCents(f.total_cents), 0)), pendientes_c: pending.length, pendientes_t: round2(pending.reduce((s, f) => s + fromCents(f.total_cents), 0)) },
    precios_subida: dev.map(d => ({ nombre: d.name, diff_pct: d.changePct, precio: d.current, vendor: d.supplier })),
    food_cost_critico: criticalRecipes(ctx, 35, 4).map(r => ({ nombre: r.name, pct: Math.round(r.foodCostPct) })),
  }
}

function weeklyPurchase(ctx: Ctx, platos: { nombre: string; raciones: number }[]) {
  const recipes = listRecipes(ctx)
  const ingredients = listIngredients(ctx)
  const suppliers = listSuppliers(ctx)
  const result = platos.map(p => {
    const r = matchByName(p.nombre, recipes)?.item
    if (!r) return { nombre: p.nombre, raciones: p.raciones, encontrada: false, lineas: [] as any[] }
    const items = ingredientsToConsume(ctx, r.id, Math.max(1, Math.round(p.raciones)))
    return { nombre: r.name, raciones: p.raciones, encontrada: true, lineas: items.map(it => {
      const ing = it.ingredientId != null ? ingredients.find(i => i.id === it.ingredientId) : undefined
      const sup = ing?.supplier_id ? suppliers.find(s => s.id === ing.supplier_id) : undefined
      return { ingrediente_id: it.ingredientId, nombre: it.name, cantidad: round2(it.qty), unidad: it.unit, coste_unitario: ing?.cost ?? null, proveedor: sup?.name ?? null, proveedor_id: sup?.id ?? null, proveedor_email: sup?.email ?? null, proveedor_phone: sup?.phone ?? null, receta: r.name }
    }) }
  })
  const found = result.filter(p => p.encontrada)
  if (!found.length) return `No encontré ninguna de las recetas: ${platos.map(p => p.nombre).join(', ')}. Comprueba que están en el escandallo.`
  const groups = new Map<string, { proveedor: any; items: Map<string, any> }>()
  const noSupplier = new Map<string, any>()
  for (const p of found) for (const l of p.lineas) {
    const key = norm(l.nombre)
    const target = l.proveedor ? (groups.get(l.proveedor) ?? groups.set(l.proveedor, { proveedor: { id: l.proveedor_id, nombre: l.proveedor, email: l.proveedor_email, phone: l.proveedor_phone }, items: new Map() }).get(l.proveedor)!).items : noSupplier
    const cur = target.get(key)
    if (cur) { cur.cantidad = round2(cur.cantidad + l.cantidad); if (!cur.recetas.includes(l.receta)) cur.recetas.push(l.receta) }
    else target.set(key, { ...l, recetas: [l.receta] })
  }
  const grupos = Array.from(groups.values()).map(g => {
    const items = Array.from(g.items.values()).map(i => ({ ...i, subtotal: i.coste_unitario != null ? round2(i.cantidad * i.coste_unitario) : null }))
    return { proveedor: g.proveedor, items, coste_total: round2(items.reduce((s, i) => s + (i.subtotal ?? 0), 0)) }
  })
  return card('__COMPRA_SEMANAL__', { platos: result, grupos, sinProveedor: Array.from(noSupplier.values()), coste_total_estimado: round2(grupos.reduce((s, g) => s + g.coste_total, 0)) })
}

/** Proyecciones: food cost a 30/60 días por tendencia de precios, ciclos de reposición, aceleración y caja semanal. */
function predictive(ctx: Ctx): string {
  const ref = today(), refMs = Date.parse(ref), since = addDays(ref, -90)
  const obs = ctx.db.prepare('SELECT ingredient_id, unit_price, observed_on FROM price_observations WHERE org_id = ? AND ingredient_id IS NOT NULL AND observed_on >= ? ORDER BY ingredient_id, observed_on, id').all(ctx.orgId, since) as { ingredient_id: number; unit_price: number; observed_on: string }[]
  const series = new Map<number, { x: number; y: number }[]>()
  for (const o of obs) (series.get(o.ingredient_id) ?? series.set(o.ingredient_id, []).get(o.ingredient_id)!).push({ x: Date.parse(o.observed_on) / 86400000, y: o.unit_price })
  const slope = new Map<number, number>()
  series.forEach((pts, id) => {
    if (pts.length < 2) return
    const xm = pts.reduce((s, p) => s + p.x, 0) / pts.length, ym = pts.reduce((s, p) => s + p.y, 0) / pts.length
    let num = 0, den = 0
    for (const p of pts) { num += (p.x - xm) * (p.y - ym); den += (p.x - xm) ** 2 }
    slope.set(id, den > 0 ? num / den : 0)
  })
  const refs = _refs(ctx)
  const ingById = new Map(refs.ingredients.map(i => [i.id, i]))
  const lineIng = new Map(refs.lines.map(l => [l.id, l.ingredientId]))
  const fc: any[] = []
  recipeCosts(ctx).forEach(c => {
    if (c.kind !== 'dish' || !(c.salePrice && c.salePrice > 0) || c.perPortion <= 0) return
    let c30 = 0, c60 = 0, top = { name: '', delta: 0 }
    for (const l of c.lines) {
      const ingId = lineIng.get(l.lineId) ?? null
      const ing = ingId != null ? ingById.get(ingId) : undefined
      const s = ingId != null ? slope.get(ingId) ?? 0 : 0
      const f = ing?.cost && ing.cost > 0 ? (d: number) => Math.max(0, ing.cost! + s * d) / ing.cost! : () => 1
      c30 += l.cost * f(30); c60 += l.cost * f(60)
      const delta = l.cost * (f(60) - 1)
      if (delta > top.delta) top = { name: l.name, delta }
    }
    const portions = c.total > 0 ? c.total / c.perPortion : 1
    const pct = (x: number) => (x / portions / c.salePrice!) * 100
    const p60 = pct(c60), p0 = c.foodCostPct ?? pct(c.total)
    if (p60 >= 33 && p60 <= 300 && p60 - p0 >= 2) fc.push({ receta: c.name, pct_actual: Math.round(p0), pct_30: Math.round(pct(c30)), pct_60: Math.round(p60), ingrediente_top: top.name || null })
  })
  fc.sort((a, b) => b.pct_60 - a.pct_60)

  const dates = ctx.db.prepare(`SELECT l.ingredient_id, i.name, s.name AS supplier, d.delivery_date FROM delivery_note_lines l JOIN delivery_notes d ON d.id = l.delivery_note_id JOIN ingredients i ON i.id = l.ingredient_id LEFT JOIN suppliers s ON s.id = i.supplier_id
                                WHERE l.org_id = ? AND d.status IN ('validated','invoiced') AND l.ingredient_id IS NOT NULL GROUP BY l.ingredient_id, d.delivery_date ORDER BY l.ingredient_id, d.delivery_date`).all(ctx.orgId) as any[]
  const byIng = new Map<number, any[]>()
  for (const r of dates) (byIng.get(r.ingredient_id) ?? byIng.set(r.ingredient_id, []).get(r.ingredient_id)!).push(r)
  const cycles: any[] = []
  byIng.forEach(rows => {
    if (rows.length < 3) return
    const gaps = rows.slice(1).map((r, i) => Math.round((Date.parse(r.delivery_date) - Date.parse(rows[i].delivery_date)) / 86400000)).sort((a, b) => a - b)
    const median = gaps[Math.floor(gaps.length / 2)]
    if (median < 1 || median > 60) return
    const daysSince = Math.floor((refMs - Date.parse(rows[rows.length - 1].delivery_date)) / 86400000)
    const diff = daysSince - median
    if (diff >= -1) cycles.push({ ingrediente: rows[0].name, proveedor: rows[0].supplier, ciclo_dias: median, dias_desde: daysSince, toca: diff >= 1 ? 'retrasado' : diff === 0 ? 'hoy' : 'manana' })
  })
  cycles.sort((a, b) => (b.dias_desde - b.ciclo_dias) - (a.dias_desde - a.ciclo_dias))

  const accel: any[] = []
  series.forEach((pts, id) => {
    if (pts.length < 4) return
    let count = 0
    for (let i = pts.length - 1; i > 0; i--) { if (pts[i].y > pts[i - 1].y) count++; else break }
    if (count < 3) return
    const start = pts[pts.length - 1 - count].y, cur = pts[pts.length - 1].y
    accel.push({ nombre: ingById.get(id)?.name ?? `#${id}`, subidas_consecutivas: count, precio_inicio: start, precio_actual: cur, diff_pct: start > 0 ? Math.round(((cur - start) / start) * 100) : 0 })
  })
  accel.sort((a, b) => b.diff_pct - a.diff_pct)

  const weeks = new Map<string, any>()
  for (const f of listInvoices(ctx, { status: 'pending' })) {
    if (!f.due_date || f.due_date < addDays(ref, -7) || f.due_date > addDays(ref, 45)) continue
    const d = new Date(f.due_date + 'T00:00:00Z'), dow = (d.getUTCDay() + 6) % 7
    const monday = addDays(f.due_date, -dow)
    const w = weeks.get(monday) ?? weeks.set(monday, { inicio: monday, fin: addDays(monday, 6), total: 0, count: 0, vencidas: 0 }).get(monday)!
    w.total = round2(w.total + fromCents(f.total_cents)); w.count++; if (f.due_date < ref) w.vencidas++
  }
  const cashflow = Array.from(weeks.values()).sort((a, b) => a.inicio.localeCompare(b.inicio))
  if (!fc.length && !cycles.length && !accel.length && !cashflow.length) return 'No hay alertas predictivas. Todo apunta a estabilidad en los próximos 60 días.'
  return card('__ALERTAS_PREDICTIVAS_CARDS__', { generado: new Date().toISOString(), fc_proyectado: fc.slice(0, 6), ciclos_reposicion: cycles.slice(0, 8), aceleracion_precio: accel.slice(0, 6), cashflow })
}

// ─── Bucle del asistente ─────────────────────────────────────────────────

export interface ChatInput { messages: { role: 'user' | 'assistant'; content: string }[]; image?: string | null }
export interface ChatResponse { reply: string; action?: string; emailProposal?: any; chartData?: any; suggestions: string[]; [card: string]: any }

const FOLLOWUP = 'Asistente de Marginbite. Presenta el resultado de la herramienta al usuario de forma concisa en español. Usa listas markdown si hay varios items. No repitas datos ya formateados.'

function systemPrompt(ctx: Ctx): string {
  const c = (sql: string) => (ctx.db.prepare(sql).get(ctx.orgId) as any).c as number
  const overdue = ctx.db.prepare(`SELECT COALESCE(SUM(total_cents), 0) AS t FROM invoices WHERE org_id = ? AND status = 'pending' AND due_date < date('now')`).get(ctx.orgId) as { t: number }
  return `Eres el asistente IA de Marginbite (restaurante). Tienes herramientas para consultar y modificar los datos.

ESTADO HOY:
Ingredientes: ${c('SELECT COUNT(*) AS c FROM ingredients WHERE org_id = ? AND active = 1')} (${c('SELECT COUNT(*) AS c FROM ingredients WHERE org_id = ? AND active = 1 AND supplier_id IS NULL')} sin proveedor) | Proveedores: ${c('SELECT COUNT(*) AS c FROM suppliers WHERE org_id = ? AND active = 1')} | Pedidos: ${c('SELECT COUNT(*) AS c FROM purchase_orders WHERE org_id = ?')} | Albaranes: ${c('SELECT COUNT(*) AS c FROM delivery_notes WHERE org_id = ?')} | Facturas pendientes: ${c(`SELECT COUNT(*) AS c FROM invoices WHERE org_id = ? AND status = 'pending'`)}${overdue.t > 0 ? ` — ${fromCents(overdue.t)}€ VENCIDAS` : ''}

REGLAS:
- Responde en español, directo y conciso. Listas markdown, nunca párrafos. Precios en euros.
- USA LAS HERRAMIENTAS para consultar datos; no inventes ni adivines.
- FOTO albarán → guardar_albaran_completo con TODAS las líneas en una sola llamada. FOTO factura → extrae todo en tabla, pregunta si guardar; si confirma → guardar_factura_compra.
- "informe semanal/balance semanal" → informe_semanal. "resumen/cómo estamos/brief/estado general" → informe_diario.
- "gasto" → resumen_gastos o gasto_por_proveedor. "más caros/baratos" → top_ingredientes_coste.
- "food cost/rentabilidad/qué platos revisar" → analizar_food_cost_recetas. "quién cobra más barato/comparativa" → comparar_precios_proveedor.
- "facturas pendientes/qué debo pagar" → listar_facturas_para_pagar. "he pagado/ya pagué" → marcar_factura_pagada.
- "pendientes de recibir" → pedidos_pendientes_recibir. "ha subido de precio/alertas de precio" → alertas_subida_precio. "qué viene/predicción/tendencias" → alertas_predictivas.
- "merma/pérdidas" → ver_merma o registrar_merma. "evolución del precio de X" → historial_precio_ingrediente. "busca/qué ingredientes" → buscar_ingrediente.
- "esta semana hago X raciones de..." → calcular_compra_semanal.
- PEDIDOS: con "quiero pedir/qué tengo que pedir/repón" llama YA a analizar_necesidades_pedido (tarjeta con botones por proveedor), sin preguntar proveedor ni canal. Si ya nombra un proveedor: sugerir_items_pedido y luego proponer_pedido_*. selector_pedido solo si pide elegir manualmente.
- Nombres de artículo siempre del catálogo, nunca genéricos ("carne", "verduras").
- WhatsApp y email están integrados: nunca digas que no puedes.
- NAVEGACIÓN: "llévame a / abre X" → navegar. Para consultar datos no navegues.
- ENCADENA herramientas si la tarea tiene varios pasos y termina con un resumen breve.`
}

export async function runAssistant(ctx: Ctx, input: ChatInput, llm: Llm, maxSteps = 5): Promise<ChatResponse> {
  const messages: LlmMessage[] = input.messages.map(m => ({ role: m.role, content: m.content }))
  if (input.image && messages.length && messages[messages.length - 1].role === 'user') {
    const last = messages[messages.length - 1]
    messages[messages.length - 1] = { role: 'user', content: [{ type: 'text', text: last.content || 'Analiza esta imagen' }, { type: 'image_url', image_url: { url: input.image, detail: 'high' } }] }
  }
  const convo: LlmMessage[] = [{ role: 'system', content: systemPrompt(ctx) }, ...messages]
  const model = input.image ? 'gpt-4o' : 'gpt-4o-mini'
  let emailProposal: any = null, chartData: any = null, lastActions = '', reply = ''

  for (let step = 0; step < maxSteps; step++) {
    const r = await llm({ model, messages: convo, tools: TOOLS, maxTokens: 1500, temperature: 0.4 })
    if (!r.toolCalls.length) { reply = r.content || ''; break }
    convo.push({ role: 'assistant', content: r.content, tool_calls: r.raw?.tool_calls ?? r.toolCalls.map(t => ({ id: t.id, type: 'function', function: { name: t.name, arguments: t.arguments } })) })
    lastActions = r.toolCalls.map(t => t.name).join(', ')
    for (const tc of r.toolCalls) {
      let result: string
      try { result = await executeTool(ctx, tc.name, JSON.parse(tc.arguments || '{}')) } catch (e: any) { result = `Error: ${e?.message || 'fallo en la herramienta'}` }
      const prefix = Object.keys(TERMINAL_CARDS).find(p => result.startsWith(p))
      if (prefix) return { reply: '', action: lastActions, [TERMINAL_CARDS[prefix]]: JSON.parse(result.slice(prefix.length)), suggestions: suggestionsFor(tc.name) }
      if (result.startsWith('__CHART__')) { const p = JSON.parse(result.slice(9)); chartData = p.chart; convo.push({ role: 'tool', tool_call_id: tc.id, content: p.text }); continue }
      if (result.startsWith('__EMAIL_PROPOSAL__')) { emailProposal = JSON.parse(result.slice(18)); convo.push({ role: 'tool', tool_call_id: tc.id, content: 'Propuesta de email generada y mostrada al usuario.' }); continue }
      convo.push({ role: 'tool', tool_call_id: tc.id, content: result })
    }
  }
  if (!reply) {
    const fin = await llm({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: FOLLOWUP }, ...convo.slice(1)], maxTokens: 500, temperature: 0.2 })
    reply = fin.content || 'Hecho.'
  }
  return { reply, action: lastActions || undefined, emailProposal, chartData: chartData || undefined, suggestions: suggestionsFor(lastActions) }
}

export { parseDate, baseUnitOf }
