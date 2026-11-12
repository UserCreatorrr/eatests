// Migración v1 → v2. Lee la BD vieja en SOLO LECTURA y escribe una v2 nueva.
//
// Principios:
//  - Nada se borra en silencio. Lo que no cumple las reglas nuevas se guarda
//    de la forma más fiel posible y queda anotado en el informe.
//  - Cada usuario v1 pasa a ser una organización con ese usuario como owner.
//  - Idempotente por construcción: se ejecuta sobre una BD v2 vacía.
//  - Determinista: ejecutarla dos veces da el mismo resultado.
import Database from 'better-sqlite3'
import { createHash } from 'crypto'
import { openDatabase, type DB } from '@/server/db/connection'
import { parseDate, parseHm } from '@/server/domain/dates'
import { toCents } from '@/server/domain/money'
import { conversionFactor, parseUnit, type Unit } from '@/server/domain/units'
import { normalizeTaxId } from '@/server/services/catalog'

export interface MigrationIssue { org: string; table: string; legacyId: number | string | null; issue: string; action: string }
export interface MigrationReport {
  users: number; orgs: number
  counts: Record<string, { read: number; written: number }>
  issues: MigrationIssue[]
  idMaps: Record<string, number>   // sólo tamaños, para el log
}

const q = (db: Database.Database, sql: string, ...a: unknown[]) => db.prepare(sql).all(...a) as any[]

/** "Kg" → kg; "Tarro" → null (se anota). */
function unitOr(raw: string | null | undefined, fallback: Unit, note: (issue: string) => void): Unit {
  const u = parseUnit(raw)
  if (u) return u
  if (raw) note(`unidad "${raw}" sin equivalencia, se usa ${fallback}`)
  return fallback
}

function dateOr(raw: string | null | undefined, fallback: string, note: (issue: string) => void): string {
  const d = parseDate(raw)
  if (d) return d
  if (raw) note(`fecha "${raw}" no reconocida, se usa ${fallback}`)
  return fallback
}

export function migrateV1(legacyPath: string, targetPath: string): MigrationReport {
  const src = new Database(legacyPath, { readonly: true, fileMustExist: true })
  const dst = openDatabase(targetPath)
  if ((dst.prepare('SELECT COUNT(*) AS n FROM organizations').get() as any).n > 0) {
    throw new Error('La BD destino no está vacía')
  }
  const report: MigrationReport = { users: 0, orgs: 0, counts: {}, issues: [], idMaps: {} }
  const count = (t: string, k: 'read' | 'written', n = 1) => { (report.counts[t] ??= { read: 0, written: 0 })[k] += n }

  dst.pragma('foreign_keys = ON')
  try {
  const run = dst.transaction(() => {
    // ── Usuarios ───────────────────────────────────────────────────────
    const users = q(src, 'SELECT * FROM users ORDER BY created_at, id')
    const orgOf = new Map<string, number>()
    for (const u of users) {
      count('users', 'read')
      dst.prepare('INSERT INTO users (id, email, password_hash, name, google_sub, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(u.id, String(u.email).toLowerCase().trim(), u.password_hash ?? null, u.name ?? null, u.google_id ?? null, u.avatar ?? null, u.created_at ?? new Date().toISOString(), u.created_at ?? new Date().toISOString())
      const orgName = u.name?.trim() || String(u.email).split('@')[0]
      const org = dst.prepare('INSERT INTO organizations (name, created_at) VALUES (?, ?)').run(orgName, u.created_at ?? new Date().toISOString())
      const orgId = Number(org.lastInsertRowid)
      dst.prepare(`INSERT INTO memberships (org_id, user_id, role) VALUES (?, ?, 'owner')`).run(orgId, u.id)
      orgOf.set(u.id, orgId)
      report.users++; report.orgs++
      count('users', 'written')
    }

    orgOf.forEach((orgId, uid) => migrateOrg(src, dst, uid, orgId, report, count))

    // ── app_settings (global; el token de Gmail se migra tal cual, se cifra en el servicio) ──
    for (const s of q(src, 'SELECT key, value FROM app_settings')) {
      if (s.key.startsWith('fix_')) continue   // data-fixes de la v1, ya no aplican
      dst.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(s.key, s.value)
    }
  })
  run()

  const fk = dst.pragma('foreign_key_check') as any[]
  if (fk.length) throw new Error(`Claves foráneas rotas tras migrar: ${JSON.stringify(fk.slice(0, 5))}`)
  return report
  } finally {
    src.close()
    dst.close()
  }
}

function migrateOrg(src: Database.Database, dst: DB, uid: string, orgId: number, report: MigrationReport, count: (t: string, k: 'read' | 'written', n?: number) => void) {
  const email = (q(src, 'SELECT email FROM users WHERE id = ?', uid)[0]?.email ?? uid) as string
  const issue = (table: string, legacyId: number | string | null, what: string, action: string) =>
    report.issues.push({ org: email, table, legacyId, issue: what, action })
  const today = new Date().toISOString().slice(0, 10)

  // ── Centros ────────────────────────────────────────────────────────────
  const locByCode = new Map<string, number>()
  for (const l of q(src, 'SELECT * FROM locations WHERE user_id = ?', uid)) {
    count('locations', 'read')
    const r = dst.prepare('INSERT INTO locations (org_id, code, name, city, active, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(orgId, l.site_id, l.nombre || l.site_id, l.ciudad ?? null, l.activo ?? 1, l.created_at ?? new Date().toISOString())
    locByCode.set(String(l.site_id).toLowerCase(), Number(r.lastInsertRowid)); count('locations', 'written')
  }
  // Centros que aparecen en turnos/ventas sin estar dados de alta.
  const siteIds = new Set<string>([...q(src, 'SELECT DISTINCT site_id FROM turnos WHERE user_id = ? AND site_id IS NOT NULL', uid), ...q(src, 'SELECT DISTINCT site_id FROM ventas_franja WHERE user_id = ? AND site_id IS NOT NULL', uid), ...q(src, 'SELECT DISTINCT site_id FROM empleados WHERE user_id = ? AND site_id IS NOT NULL', uid)].map(r => String(r.site_id)))
  for (const s of Array.from(siteIds)) {
    if (locByCode.has(s.toLowerCase())) continue
    const r = dst.prepare('INSERT INTO locations (org_id, code, name) VALUES (?, ?, ?)').run(orgId, s, s)
    locByCode.set(s.toLowerCase(), Number(r.lastInsertRowid))
    issue('locations', s, 'centro usado en turnos o ventas sin ficha', 'creado a partir del código')
  }
  const loc = (code: string | null | undefined) => code ? (locByCode.get(String(code).toLowerCase()) ?? null) : null

  // ── Almacenes (texto libre en v1) ─────────────────────────────────────
  const whByName = new Map<string, number>()
  const KIND: Record<string, string> = { nevera: 'refrigerated', congelador: 'frozen', 'almacén seco': 'dry', 'almacen seco': 'dry' }
  const wh = (name: string | null | undefined): number | null => {
    const n = name?.trim(); if (!n) return null
    const k = n.toLowerCase()
    if (!whByName.has(k)) {
      const r = dst.prepare('INSERT INTO warehouses (org_id, name, kind) VALUES (?, ?, ?)').run(orgId, n, KIND[k] ?? 'other')
      whByName.set(k, Number(r.lastInsertRowid)); count('warehouses', 'written')
    }
    return whByName.get(k)!
  }

  // ── Proveedores ───────────────────────────────────────────────────────
  // v1 tenía proveedores y proveedores_detalle solapados, y los documentos
  // llevaban el nombre del proveedor en texto. Aquí hay una sola entidad,
  // identificada por NIF normalizado y, si no, por nombre.
  const supByKey = new Map<string, number>()      // nif → id, y lower(nombre) → id
  const supLegacy = new Map<number, number>()     // id v1 → id v2
  const supplierFor = (name: string | null | undefined, nif: string | null | undefined, legacyId?: number): number | null => {
    const tax = normalizeTaxId(nif); const nm = name?.trim()
    if (!tax && !nm) return null
    const hit = (tax && supByKey.get(`t:${tax}`)) || (nm && supByKey.get(`n:${nm.toLowerCase()}`))
    if (hit) {
      if (tax && !supByKey.has(`t:${tax}`)) { supByKey.set(`t:${tax}`, hit); try { dst.prepare('UPDATE suppliers SET tax_id = ? WHERE id = ?').run(tax, hit) } catch { /* otro ya lo tiene */ } }
      if (legacyId != null) supLegacy.set(legacyId, hit)
      return hit
    }
    const r = dst.prepare('INSERT INTO suppliers (org_id, name, tax_id) VALUES (?, ?, ?)').run(orgId, nm || `Proveedor ${tax}`, tax)
    const id = Number(r.lastInsertRowid)
    if (tax) supByKey.set(`t:${tax}`, id)
    if (nm) supByKey.set(`n:${nm.toLowerCase()}`, id)
    if (legacyId != null) supLegacy.set(legacyId, id)
    count('suppliers', 'written')
    return id
  }
  for (const p of q(src, 'SELECT * FROM proveedores WHERE user_id = ? ORDER BY id', uid)) {
    count('suppliers', 'read')
    const existingByTax = normalizeTaxId(p.nif) && supByKey.get(`t:${normalizeTaxId(p.nif)}`)
    const existingByName = p.descr && supByKey.get(`n:${String(p.descr).trim().toLowerCase()}`)
    if (existingByTax || existingByName) {
      supLegacy.set(p.id, (existingByTax || existingByName) as number)
      issue('proveedores', p.id, `"${p.descr}" duplica a otro proveedor (mismo ${existingByTax ? 'NIF' : 'nombre'})`, 'fusionado')
      continue
    }
    const id = supplierFor(p.descr, p.nif, p.id)!
    dst.prepare(`UPDATE suppliers SET contact_name = ?, email = ?, phone = ?, address = ?, city = ?, postal_code = ?, website = ?, notes = ?, preferred_channel = ? WHERE id = ?`)
      .run(p.contact ?? null, p.mail ?? null, p.phone ?? null, p.address ?? null, p.city ?? null, p.cp ?? null, p.web ?? null, p.comment ?? null,
           ['email', 'whatsapp', 'phone'].includes(p.canal_preferido) ? p.canal_preferido : null, id)
  }
  for (const p of q(src, 'SELECT * FROM proveedores_detalle WHERE user_id = ?', uid)) {
    count('proveedores_detalle', 'read')
    const id = supplierFor(p.descr, p.nif)
    if (id) dst.prepare(`UPDATE suppliers SET address = COALESCE(address, ?), city = COALESCE(city, ?), postal_code = COALESCE(postal_code, ?), website = COALESCE(website, ?), notes = COALESCE(notes, ?) WHERE id = ?`)
      .run(p.address ?? null, p.city ?? null, p.cp ?? null, p.web ?? null, p.comment ?? null, id)
  }

  // ── Ingredientes ──────────────────────────────────────────────────────
  const ingLegacy = new Map<number, number>()
  const ingByName = new Map<string, number>()
  for (const i of q(src, 'SELECT * FROM ingredientes WHERE user_id = ? ORDER BY id', uid)) {
    count('ingredients', 'read')
    const name = String(i.descr ?? '').trim() || `Ingrediente ${i.id}`
    const key = name.toLowerCase()
    if (ingByName.has(key)) {
      ingLegacy.set(i.id, ingByName.get(key)!)
      issue('ingredientes', i.id, `"${name}" duplicado`, 'fusionado con el primero')
      continue
    }
    const note = (s: string) => issue('ingredientes', i.id, `${name}: ${s}`, 'revisar')
    const unit = unitOr(i.unit, 'ud', note)
    const supplierId = i.proveedor_id != null ? (supLegacy.get(i.proveedor_id) ?? supplierFor(i.proveedor_nombre, null)) : supplierFor(i.proveedor_nombre, null)
    const cost = i.cost != null && i.cost >= 0 ? i.cost : null
    if (supplierId && !(cost && cost > 0)) issue('ingredientes', i.id, `"${name}" tiene proveedor pero no precio`, 'se conserva sin precio; la regla nueva lo exigirá al editar')
    const r = dst.prepare(`INSERT INTO ingredients (org_id, code, name, category, base_unit, cost, vat_rate, supplier_id, warehouse_id, secondary_warehouse_id, active)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(orgId, i.codi ?? null, name, i.type && i.type !== 'Ingrediente' ? i.type : null, unit, cost, i.iva ?? null, supplierId, wh(i.almacen_principal), wh(i.almacen_secundario))
    const id = Number(r.lastInsertRowid)
    ingLegacy.set(i.id, id); ingByName.set(key, id); count('ingredients', 'written')
  }
  const ing = (legacyId: number | null | undefined) => legacyId != null ? (ingLegacy.get(legacyId) ?? null) : null

  for (const h of q(src, 'SELECT * FROM herramientas WHERE user_id = ?', uid)) {
    count('tools', 'read')
    dst.prepare('INSERT INTO tools (org_id, code, name, category, unit, cost) VALUES (?, ?, ?, ?, ?, ?)')
      .run(orgId, h.codi ?? null, h.descr || `Herramienta ${h.id}`, h.type ?? null, unitOr(h.unit, 'ud', () => {}), h.cost ?? null)
    count('tools', 'written')
  }

  // ── Recetas ───────────────────────────────────────────────────────────
  const recLegacy = new Map<number, number>()
  const recByName = new Map<string, number>()
  const recipes = q(src, 'SELECT * FROM escandallo_receta WHERE user_id = ? ORDER BY id', uid)
  for (const r of recipes) {
    count('recipes', 'read')
    let name = String(r.nombre ?? '').trim() || `Receta ${r.id}`
    if (recByName.has(name.toLowerCase())) {
      // Dos recetas con el mismo nombre eran dos registros distintos (la demo
      // los duplicaba): se conservan las dos, la segunda con sufijo.
      name = `${name} (${r.id})`
      issue('escandallo_receta', r.id, `nombre duplicado "${r.nombre}"`, `renombrada a "${name}"`)
    }
    const note = (s: string) => issue('escandallo_receta', r.id, `${name}: ${s}`, 'revisar')
    const isPrep = !!r.es_subreceta
    const yieldUnit = r.cantidad_producida > 0 ? unitOr(r.unidad_producida, 'g', note) : null
    const ins = dst.prepare(`INSERT INTO recipes (org_id, code, name, category, kind, portions, yield_qty, yield_unit, portion_weight_g, sale_price, general_waste_pct, description, allergens, procedure_json, conservation, regeneration, notes, source, active)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(orgId, r.codigo ?? null, name, r.categoria ?? null, isPrep ? 'preparation' : 'dish', r.raciones > 0 ? r.raciones : 1,
           yieldUnit ? r.cantidad_producida : null, yieldUnit, r.gramos_porcion > 0 ? r.gramos_porcion : null, r.precio_venta >= 0 ? r.precio_venta : null,
           r.merma_pct >= 0 && r.merma_pct <= 95 ? r.merma_pct : null, r.descripcion ?? null, r.alergenos ?? null,
           r.procedimiento && isJson(r.procedimiento) ? r.procedimiento : null, r.conservacion ?? null, r.regeneracion ?? null,
           [r.notas, r.ingredientes ? `Ingredientes (texto libre v1): ${r.ingredientes}` : null].filter(Boolean).join('\n') || null,
           r.source === 'excel' ? 'excel' : 'legacy', r.activo ?? 1)
    const id = Number(ins.lastInsertRowid)
    recLegacy.set(r.id, id); recByName.set(name.toLowerCase(), id); count('recipes', 'written')
  }
  // Líneas. Las que apuntan a una receta que no existe se anotan y se descartan
  // (no hay dónde colgarlas); el resto se migra con la cantidad NETA y la merma.
  const lines = q(src, 'SELECT * FROM escandallo_lineas WHERE user_id = ? ORDER BY receta_id, id', uid)
  let sort = 0, lastRecipe = -1
  const pendingSub: { lineId: number; subLegacy: number }[] = []
  for (const l of lines) {
    count('recipe_lines', 'read')
    const recipeId = recLegacy.get(l.receta_id)
    if (!recipeId) { issue('escandallo_lineas', l.id, `línea de la receta ${l.receta_id}, que no existe`, 'descartada'); continue }
    if (l.receta_id !== lastRecipe) { sort = 0; lastRecipe = l.receta_id }
    const note = (s: string) => issue('escandallo_lineas', l.id, s, 'revisar')
    const ingredientId = ing(l.ingrediente_id)
    const subLegacy = l.subreceta_id ?? null
    const qty = Number(l.cantidad) > 0 ? Number(l.cantidad) : null
    if (!qty) { issue('escandallo_lineas', l.id, 'cantidad 0 o vacía', 'descartada'); continue }
    let unit: Unit
    if (ingredientId) {
      const base = (dst.prepare('SELECT base_unit FROM ingredients WHERE id = ?').get(ingredientId) as any).base_unit as Unit
      unit = unitOr(l.unidad, base, note)
    } else unit = unitOr(l.unidad, 'ud', note)
    const waste = typeof l.merma_pct === 'number' && l.merma_pct >= 0 && l.merma_pct <= 95 ? l.merma_pct : 0
    let kind: 'ing' | 'sub' | 'free'
    if (ingredientId) kind = 'ing'
    else if (subLegacy != null && recLegacy.has(subLegacy)) kind = 'sub'
    else kind = 'free'
    if (l.ingrediente_id != null && !ingredientId) issue('escandallo_lineas', l.id, `ingrediente ${l.ingrediente_id} no existe`, 'pasa a línea libre')
    const freeName = kind === 'free' ? (l.nombre_libre?.trim() || `Línea ${l.id}`) : null
    const r = dst.prepare(`INSERT INTO recipe_lines (org_id, recipe_id, ingredient_id, sub_recipe_id, free_name, free_unit_cost, qty, unit, waste_pct, sort_order, note)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(orgId, recipeId, kind === 'ing' ? ingredientId : null, kind === 'sub' ? recLegacy.get(subLegacy!) : null, freeName,
           kind === 'free' ? (l.coste_unitario >= 0 ? l.coste_unitario : null) : null, qty, unit, waste, sort++, l.nota ?? null)
    if (kind === 'sub') pendingSub.push({ lineId: Number(r.lastInsertRowid), subLegacy: subLegacy! })
    count('recipe_lines', 'written')
  }
  // Subrecetas: la unidad de la línea tiene que ser compatible con la producción.
  for (const p of pendingSub) {
    const row = dst.prepare(`SELECT l.unit, s.yield_unit, s.name FROM recipe_lines l JOIN recipes s ON s.id = l.sub_recipe_id WHERE l.id = ?`).get(p.lineId) as any
    if (!row.yield_unit) issue('escandallo_lineas', p.lineId, `usa "${row.name}", que no declara producción`, 'la línea no sumará hasta declararla')
  }

  // ── Imágenes de documentos ────────────────────────────────────────────
  const image = (data: string | null | undefined): number | null => {
    if (!data) return null
    const mime = /^data:([^;]+);/.exec(data)?.[1] ?? 'image/jpeg'
    const r = dst.prepare('INSERT INTO document_images (org_id, mime, data, bytes) VALUES (?, ?, ?, ?)').run(orgId, mime, data, Buffer.byteLength(data))
    count('document_images', 'written')
    return Number(r.lastInsertRowid)
  }

  // ── Pedidos ───────────────────────────────────────────────────────────
  const poLegacy = new Map<number, number>()
  const poNumbers = new Set<string>()
  for (const p of q(src, 'SELECT * FROM pedidos_compra WHERE user_id = ? ORDER BY id', uid)) {
    count('purchase_orders', 'read')
    const note = (s: string) => issue('pedidos_compra', p.id, s, 'revisar')
    const supplierId = supplierFor(p.vendor, p.nif)
    if (!supplierId) { issue('pedidos_compra', p.id, 'pedido sin proveedor', 'descartado'); continue }
    let number = String(p.num_order ?? '').trim() || `PED-LEGACY-${p.id}`
    if (poNumbers.has(number)) { number = `${number}-${p.id}`; issue('pedidos_compra', p.id, 'número duplicado', `renumerado ${number}`) }
    poNumbers.add(number)
    const orderDate = dateOr(p.date_order, today, note)
    const status = p.date_reception ? 'received' : (p.sent_by ? 'sent' : 'draft')
    const r = dst.prepare(`INSERT INTO purchase_orders (org_id, number, supplier_id, status, order_date, sent_at, sent_via, declared_total_cents, created_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(orgId, number, supplierId, status, orderDate, p.sent_by ? orderDate : null, p.sent_by === 'whatsapp' ? 'whatsapp' : (p.sent_by ? 'manual' : null),
           p.total >= 0 ? toCents(p.total) : null, orderDate)
    poLegacy.set(p.id, Number(r.lastInsertRowid)); count('purchase_orders', 'written')
  }
  for (const l of q(src, 'SELECT * FROM pedidos_compra_lineas WHERE user_id = ? ORDER BY pedido_id, id', uid)) {
    count('purchase_order_lines', 'read')
    const orderId = poLegacy.get(l.pedido_id); if (!orderId) { issue('pedidos_compra_lineas', l.id, 'pedido inexistente', 'descartada'); continue }
    const qty = Number(l.cantidad) > 0 ? Number(l.cantidad) : null
    if (!qty) { issue('pedidos_compra_lineas', l.id, 'cantidad vacía', 'descartada'); continue }
    const ingredientId = ing(l.ingrediente_id)
    const unit = unitOr(l.unidad, 'ud', s => issue('pedidos_compra_lineas', l.id, s, 'revisar'))
    dst.prepare(`INSERT INTO purchase_order_lines (org_id, order_id, ingredient_id, description, qty, unit, unit_cost_estimate, warehouse_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(orgId, orderId, ingredientId, l.nombre || 'Línea', qty, unit, l.coste_estimado > 0 ? l.coste_estimado / qty : null, wh(l.almacen_destino))
    count('purchase_order_lines', 'written')
  }

  // ── Albaranes ─────────────────────────────────────────────────────────
  const dnLegacy = new Map<number, number>()
  const dnKeys = new Set<string>()
  for (const a of q(src, 'SELECT * FROM albaranes_compra WHERE user_id = ? ORDER BY id', uid)) {
    count('delivery_notes', 'read')
    const note = (s: string) => issue('albaranes_compra', a.id, s, 'revisar')
    const supplierId = supplierFor(a.vendor, a.nif)
    if (!supplierId) { issue('albaranes_compra', a.id, 'albarán sin proveedor', 'descartado'); continue }
    let number = String(a.delivery_num ?? '').trim() || `ALB-LEGACY-${a.id}`
    const key = `${supplierId}:${number}`
    if (dnKeys.has(key)) { number = `${number} (dup ${a.id})`; issue('albaranes_compra', a.id, `albarán ${a.delivery_num} duplicado para el mismo proveedor`, `conservado como "${number}" en revisión`) }
    dnKeys.add(`${supplierId}:${number}`)
    const base = toCents(a.base), vat = toCents(a.taxes), total = a.total != null ? toCents(a.total) : base + vat
    // Estado: lo que la v1 llamaba "validado" solo lo mantiene si tiene líneas.
    const hasLines = (q(src, `SELECT COUNT(*) AS n FROM lineas_albaran_compra WHERE user_id = ? AND ((doc_tipo = 'albaran' AND doc_id = ?) OR (doc_tipo IS NULL AND albaran_id = ?))`, uid, a.id, a.id)[0].n as number) > 0
    let status: 'draft' | 'review' | 'validated' = 'draft'
    if (a.estado === 'validado' && hasLines) status = 'validated'
    else if (a.estado === 'validado' || a.estado === 'parcial' || a.estado === 'revisar') status = 'review'
    if (a.estado === 'validado' && !hasLines) issue('albaranes_compra', a.id, 'validado sin líneas', 'pasa a revisión')
    if (number.includes('(dup')) status = 'review'
    const r = dst.prepare(`INSERT INTO delivery_notes (org_id, supplier_id, number, delivery_date, base_cents, vat_cents, total_cents, image_id, source, received_by, status, validated_at, created_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, ?)`)
      .run(orgId, supplierId, number, dateOr(a.date_delivery, today, note), base, vat, total, image(a.doc_image), a.source === 'scanny' ? 'scan' : 'legacy', a.received_by ?? null, parseDate(a.date_delivery) ?? today)
    const id = Number(r.lastInsertRowid)
    dnLegacy.set(a.id, id)
    ;(dnLegacy as any)[`status:${id}`] = status
    count('delivery_notes', 'written')
  }

  // Líneas de albarán. En v1 había tres formas de enlazarlas; 251 de 305 no
  // estaban enlazadas a ningún documento (datos demo): esas se conservan como
  // observaciones de precio y como albaranes "legacy" por (proveedor, fecha).
  const orphanNotes = new Map<string, number>()
  for (const l of q(src, 'SELECT * FROM lineas_albaran_compra WHERE user_id = ? ORDER BY id', uid)) {
    count('delivery_note_lines', 'read')
    const note = (s: string) => issue('lineas_albaran_compra', l.id, s, 'revisar')
    const ingredientId = ing(l.ingrediente_id) ?? (l.nombre ? ingByName.get(String(l.nombre).trim().toLowerCase()) ?? null : null)
    const unit = l.unidad ? unitOr(l.unidad, 'ud', note) : null
    const lineDate = dateOr(l.fecha, today, note)
    let noteId: number | null = null
    if (l.doc_tipo === 'albaran' && l.doc_id != null) noteId = dnLegacy.get(l.doc_id) ?? null
    else if (l.doc_tipo == null && l.albaran_id != null) noteId = dnLegacy.get(l.albaran_id) ?? null
    if (l.doc_tipo === 'factura') {
      // Línea colgada de una factura: se conserva como observación de precio.
      if (ingredientId && l.precio_unitario != null) {
        dst.prepare(`INSERT INTO price_observations (org_id, ingredient_id, supplier_id, description, qty, unit, unit_price, line_total, observed_on, source_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'legacy')`)
          .run(orgId, ingredientId, supplierFor(l.vendor, null), l.nombre ?? '', l.cantidad ?? null, unit, l.precio_unitario, l.total_linea ?? null, lineDate)
      }
      continue
    }
    if (!noteId) {
      const supplierId = supplierFor(l.vendor, null)
      if (!supplierId) { issue('lineas_albaran_compra', l.id, 'línea sin documento ni proveedor', 'descartada'); continue }
      const k = `${supplierId}:${lineDate}`
      if (!orphanNotes.has(k)) {
        const number = `ALB-LEGACY-${lineDate.replace(/-/g, '')}-${supplierId}`
        const r = dst.prepare(`INSERT INTO delivery_notes (org_id, supplier_id, number, delivery_date, source, status, notes, created_at) VALUES (?, ?, ?, ?, 'legacy', 'draft', 'Reconstruido a partir de líneas sueltas de la v1', ?)`)
          .run(orgId, supplierId, number, lineDate, lineDate)
        orphanNotes.set(k, Number(r.lastInsertRowid)); count('delivery_notes', 'written')
        issue('lineas_albaran_compra', l.id, 'líneas sin albarán', `agrupadas en ${number}`)
      }
      noteId = orphanNotes.get(k)!
    }
    dst.prepare(`INSERT INTO delivery_note_lines (org_id, delivery_note_id, ingredient_id, description, qty, unit, unit_price, previous_unit_price, vat_rate, line_total_cents, warehouse_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(orgId, noteId, ingredientId, l.nombre || l.ingrediente_nombre || 'Línea', l.cantidad > 0 ? l.cantidad : null, unit, l.precio_unitario >= 0 ? l.precio_unitario : null,
           l.precio_anterior ?? null, l.iva_pct ?? null, l.total_linea != null ? toCents(l.total_linea) : null, wh(l.almacen_destino))
    count('delivery_note_lines', 'written')
  }
  // Estados definitivos de los albaranes (ahora que tienen líneas) y entradas de stock de los validados.
  for (const [legacyId, id] of Array.from(dnLegacy.entries())) {
    if (typeof legacyId !== 'number') continue
    const status = (dnLegacy as any)[`status:${id}`] as string
    const n = (dst.prepare('SELECT COUNT(*) AS n FROM delivery_note_lines WHERE delivery_note_id = ?').get(id) as any).n
    const final = status === 'validated' && n > 0 ? 'validated' : (status === 'validated' ? 'review' : status)
    dst.prepare('UPDATE delivery_notes SET status = ?, validated_at = CASE WHEN ? = ? THEN created_at ELSE NULL END WHERE id = ?').run(final, final, 'validated', id)
    if (final === 'validated') {
      for (const l of dst.prepare('SELECT * FROM delivery_note_lines WHERE delivery_note_id = ? AND ingredient_id IS NOT NULL AND qty > 0').all(id) as any[]) {
        const base = (dst.prepare('SELECT base_unit FROM ingredients WHERE id = ?').get(l.ingredient_id) as any).base_unit as Unit
        const unit = (l.unit as Unit | null) ?? base
        const dn = dst.prepare('SELECT delivery_date FROM delivery_notes WHERE id = ?').get(id) as any
        try {
          const f = conversionFactor(unit, base)
          dst.prepare(`INSERT INTO stock_movements (org_id, ingredient_id, warehouse_id, qty, unit_cost, kind, source_type, source_id, occurred_at, note) VALUES (?, ?, ?, ?, ?, 'receipt', 'delivery_note', ?, ?, 'migrado de v1')`)
            .run(orgId, l.ingredient_id, l.warehouse_id, l.qty * f, l.unit_price != null ? l.unit_price / f : null, id, dn.delivery_date)
          count('stock_movements', 'written')
        } catch { issue('delivery_note_lines', l.id, `unidad ${unit} incompatible con ${base}`, 'sin movimiento de stock') }
      }
    }
  }

  // ── Facturas ──────────────────────────────────────────────────────────
  const invKeys = new Set<string>()
  for (const f of q(src, 'SELECT * FROM facturas_compra WHERE user_id = ? ORDER BY id', uid)) {
    count('invoices', 'read')
    const note = (s: string) => issue('facturas_compra', f.id, s, 'revisar')
    const supplierId = supplierFor(f.vendor, f.nif)
    if (!supplierId) { issue('facturas_compra', f.id, 'factura sin proveedor', 'descartada'); continue }
    let number = String(f.invoice_num ?? f.document_num ?? '').trim() || `FAC-LEGACY-${f.id}`
    if (invKeys.has(`${supplierId}:${number}`)) { number = `${number} (dup ${f.id})`; issue('facturas_compra', f.id, 'factura duplicada', `conservada como "${number}"`) }
    invKeys.add(`${supplierId}:${number}`)
    const invoiceDate = dateOr(f.date_invoice, today, note)
    let due = f.date_due ? parseDate(f.date_due) : null
    if (due && due < invoiceDate) { issue('facturas_compra', f.id, `vencimiento ${due} anterior a la factura ${invoiceDate}`, 'vencimiento eliminado'); due = null }
    const base = toCents(f.base), vat = toCents(f.taxes), total = f.total != null ? toCents(f.total) : base + vat
    if (total > 0 && Math.abs(base + vat - total) > Math.max(2, Math.round(total * 0.01))) issue('facturas_compra', f.id, `base+IVA (${((base + vat) / 100).toFixed(2)}) no cuadra con total (${(total / 100).toFixed(2)})`, 'conservada tal cual')
    dst.prepare(`INSERT INTO invoices (org_id, supplier_id, number, invoice_date, due_date, accounting_date, base_cents, vat_cents, total_cents, status, paid_on, payment_method, lines_resolved, image_id, source, notes, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(orgId, supplierId, number, invoiceDate, due, f.date_accounting ? parseDate(f.date_accounting) : null, base, vat, total, f.paid ? 'paid' : 'pending', f.paid ? invoiceDate : null,
           f.code_payment_type ?? null, f.validated ? 1 : 0, image(f.doc_image), f.source === 'scanny' ? 'scan' : 'legacy', f.comment ?? null, invoiceDate)
    count('invoices', 'written')
  }

  // ── Precios ───────────────────────────────────────────────────────────
  for (const p of q(src, 'SELECT * FROM precio_historial WHERE user_id = ? ORDER BY fecha, id', uid)) {
    count('price_observations', 'read')
    const ingredientId = ing(p.ingrediente_id) ?? (p.nombre ? ingByName.get(String(p.nombre).trim().toLowerCase()) ?? null : null)
    if (p.precio == null || p.precio < 0) continue
    const src_ = p.fuente === 'albaran' ? 'delivery_note' : p.fuente === 'factura' ? 'invoice' : p.fuente === 'onboarding' ? 'import' : 'legacy'
    const sourceId = p.doc_tipo === 'albaran' && p.doc_id != null ? dnLegacy.get(p.doc_id) ?? null : null
    dst.prepare(`INSERT INTO price_observations (org_id, ingredient_id, supplier_id, description, unit, unit_price, previous_price, observed_on, source_type, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(orgId, ingredientId, supplierFor(p.vendor, null), p.nombre ?? '', parseUnit(p.unidad), p.precio, p.precio_anterior ?? null, dateOr(p.fecha, today, () => {}), src_, sourceId)
    count('price_observations', 'written')
  }

  // ── Merma ─────────────────────────────────────────────────────────────
  for (const m of q(src, 'SELECT * FROM merma_registro WHERE user_id = ? ORDER BY id', uid)) {
    count('waste_records', 'read')
    const note = (s: string) => issue('merma_registro', m.id, s, 'revisar')
    const ingredientId = ing(m.ingrediente_id)
    const recipeId = m.tipo === 'receta' ? (recByName.get(String(m.nombre ?? '').toLowerCase()) ?? null) : null
    const qty = Number(m.cantidad) > 0 ? Number(m.cantidad) : null
    if (!qty) { issue('merma_registro', m.id, 'merma sin cantidad', 'descartada'); continue }
    dst.prepare(`INSERT INTO waste_records (org_id, kind, ingredient_id, recipe_id, description, qty, unit, reason, estimated_cost, occurred_on, location_id, warehouse_id, service, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(orgId, m.tipo === 'receta' ? 'dish' : 'ingredient', ingredientId, recipeId, m.nombre || 'Merma', qty, unitOr(m.unidad, 'ud', note), m.motivo ?? null,
           m.coste_estimado >= 0 ? m.coste_estimado : null, dateOr(m.fecha, today, note), loc(m.site_id), wh(m.almacen), m.servicio ?? null, m.notas ?? null)
    count('waste_records', 'written')
  }

  for (const p of q(src, 'SELECT * FROM ventas_produccion WHERE user_id = ?', uid)) {
    count('production_records', 'read')
    if (!(p.raciones > 0)) continue
    dst.prepare('INSERT INTO production_records (org_id, recipe_id, description, portions, produced_on, notes) VALUES (?, ?, ?, ?, ?, ?)')
      .run(orgId, p.receta_id != null ? recLegacy.get(p.receta_id) ?? null : null, p.nombre || 'Producción', Math.round(p.raciones), dateOr(p.fecha, today, () => {}), p.notas ?? null)
    count('production_records', 'written')
  }

  for (const l of q(src, 'SELECT * FROM lista_pedidos WHERE user_id = ?', uid)) {
    count('order_templates', 'read')
    dst.prepare('INSERT INTO order_templates (org_id, name, period_year, period_month) VALUES (?, ?, ?, ?)')
      .run(orgId, l.descr || `Plantilla ${l.id}`, l.year ?? null, l.month >= 1 && l.month <= 12 ? l.month : null)
    count('order_templates', 'written')
  }

  // ── Ventas (documental) ───────────────────────────────────────────────
  for (const a of q(src, 'SELECT * FROM albaranes_venta WHERE user_id = ?', uid)) {
    count('sales_documents', 'read')
    dst.prepare(`INSERT INTO sales_documents (org_id, kind, number, customer_name, customer_type, customer_tax_id, doc_date, base_cents) VALUES (?, 'delivery_note', ?, ?, ?, ?, ?, ?)`)
      .run(orgId, a.invoice_num ?? null, a.customer ?? null, a.customer_type ?? null, a.nif ?? null, parseDate(a.date_delivery), toCents(a.base))
    count('sales_documents', 'written')
  }
  for (const f of q(src, 'SELECT * FROM facturas_venta WHERE user_id = ?', uid)) {
    count('sales_documents', 'read')
    dst.prepare(`INSERT INTO sales_documents (org_id, kind, number, customer_name, customer_tax_id, doc_date, due_date, base_cents, vat_cents, total_cents, paid, notes) VALUES (?, 'invoice', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(orgId, f.invoice_num ?? null, f.customer ?? null, f.nif ?? null, parseDate(f.date_invoice), parseDate(f.date_due), toCents(f.base), toCents(f.taxes), toCents(f.total), f.paid ? 1 : 0, f.comment ?? null)
    count('sales_documents', 'written')
  }

  // ── Labor ─────────────────────────────────────────────────────────────
  const empLegacy = new Map<number, number>()
  for (const e of q(src, 'SELECT * FROM empleados WHERE user_id = ? ORDER BY id', uid)) {
    count('employees', 'read')
    const r = dst.prepare(`INSERT INTO employees (org_id, code, name, location_id, role, contract_type, hourly_cost, employer_cost, contract_hours_week, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(orgId, e.employee_id ?? null, e.nombre || `Empleado ${e.id}`, loc(e.site_id), e.rol ?? null, e.tipo_contrato ?? null, e.coste_hora ?? null, e.coste_empresa ?? null,
           e.contract_hours_week >= 0 && e.contract_hours_week <= 80 ? e.contract_hours_week : null, e.activo ?? 1, e.created_at ?? new Date().toISOString())
    empLegacy.set(e.id, Number(r.lastInsertRowid)); count('employees', 'written')
  }
  const shiftIns = dst.prepare(`INSERT OR IGNORE INTO shifts (org_id, location_id, employee_id, employee_name, role, service, shift_date, start_time, end_time, break_minutes, planned_hours, actual_hours, hourly_cost, overnight, source, created_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  for (const t of q(src, 'SELECT * FROM turnos WHERE user_id = ? ORDER BY id', uid)) {
    count('shifts', 'read')
    const note = (s: string) => issue('turnos', t.id, s, 'descartado')
    const d = parseDate(t.fecha), st = parseHm(t.start_time), en = parseHm(t.end_time)
    if (!d || !st || !en) { note('fecha u hora no válidas'); continue }
    const r = shiftIns.run(orgId, loc(t.site_id), t.employee_id != null ? empLegacy.get(t.employee_id) ?? null : null, t.employee_name || 'Sin nombre', t.rol ?? null, t.servicio ?? null,
                           d, st, en, t.break_minutes >= 0 ? t.break_minutes : 0, t.horas_plan >= 0 && t.horas_plan <= 24 ? t.horas_plan : 0, t.horas_real ?? null, t.coste_hora ?? null, t.overnight ? 1 : 0, t.source ?? 'legacy', t.created_at ?? new Date().toISOString())
    if (r.changes) count('shifts', 'written'); else issue('turnos', t.id, 'turno duplicado', 'descartado')
  }
  const slotIns = dst.prepare(`INSERT OR IGNORE INTO sales_slots (org_id, location_id, sale_date, slot_start, slot_end, channel, net_sales, covers, orders, tickets, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  for (const v of q(src, 'SELECT * FROM ventas_franja WHERE user_id = ? ORDER BY id', uid)) {
    count('sales_slots', 'read')
    const d = parseDate(v.fecha), st = parseHm(v.timeslot_start)
    if (!d || !st) { issue('ventas_franja', v.id, 'fecha u hora no válidas', 'descartada'); continue }
    const r = slotIns.run(orgId, loc(v.site_id), d, st, parseHm(v.timeslot_end), v.channel || 'sala', v.sales_net >= 0 ? v.sales_net : 0, v.covers ?? null, v.orders ?? null, v.tickets ?? null, v.source ?? 'legacy', v.created_at ?? new Date().toISOString())
    if (r.changes) count('sales_slots', 'written'); else issue('ventas_franja', v.id, 'franja duplicada', 'descartada')
  }
  for (const t of q(src, 'SELECT * FROM targets_productividad WHERE user_id = ?', uid)) {
    count('labor_targets', 'read')
    dst.prepare(`INSERT INTO labor_targets (org_id, location_id, service, role, target_labor_pct, target_splh, target_sales_per_employee, target_productivity_index, min_staff, max_staff) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(orgId, loc(t.site_id), t.servicio ?? null, t.rol ?? null, t.target_labor_pct > 0 && t.target_labor_pct <= 100 ? t.target_labor_pct : null, t.target_splh ?? null,
           t.target_sales_per_employee ?? null, t.target_productivity_index ?? null, t.min_staff_role ?? null, t.max_staff_role ?? null)
    count('labor_targets', 'written')
  }

  // ── Informes y avisos ─────────────────────────────────────────────────
  for (const r of q(src, 'SELECT * FROM reports_recipients WHERE user_id = ?', uid)) {
    count('report_recipients', 'read')
    const scope = r.scope === 'local' ? 'location' : 'group'
    const locationId = loc(r.site_id)
    if (scope === 'location' && !locationId) { issue('reports_recipients', r.id, 'destinatario local sin centro', 'pasa a ámbito grupo'); }
    dst.prepare(`INSERT INTO report_recipients (org_id, email, name, role_in_org, scope, location_id, active) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(orgId, r.email, r.nombre ?? null, r.role_in_org ?? null, scope === 'location' && locationId ? 'location' : 'group', scope === 'location' ? locationId : null, r.activo ?? 1)
    count('report_recipients', 'written')
  }
  for (const b of q(src, 'SELECT * FROM reports_briefs WHERE user_id = ?', uid)) {
    count('report_briefs', 'read')
    if (!isJson(b.payload)) continue
    dst.prepare(`INSERT INTO report_briefs (org_id, scope, location_id, brief_date, payload_json, data_quality, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(orgId, b.scope || 'grupo', loc(b.site_id), dateOr(b.fecha, today, () => {}), b.payload, b.data_quality ?? null, b.created_at ?? new Date().toISOString())
    count('report_briefs', 'written')
  }
  const URG: Record<string, string> = { alta: 'high', media: 'normal', baja: 'low' }
  for (const n of q(src, 'SELECT * FROM notifications WHERE user_id = ?', uid)) {
    count('notifications', 'read')
    dst.prepare(`INSERT INTO notifications (org_id, user_id, type, title, body, urgency, link, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(orgId, uid, n.type, n.title, n.body ?? null, URG[n.urgency] ?? 'normal', n.link ?? null, n.read ? (n.created_at ?? new Date().toISOString()) : null, n.created_at ?? new Date().toISOString())
    count('notifications', 'written')
  }
  for (const p of q(src, 'SELECT * FROM push_subscriptions WHERE user_id = ?', uid)) {
    dst.prepare('INSERT OR IGNORE INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)').run(uid, p.endpoint, p.p256dh, p.auth, p.created_at ?? new Date().toISOString())
  }
}

function isJson(s: unknown): boolean {
  if (typeof s !== 'string') return false
  try { JSON.parse(s); return true } catch { return false }
}

export function reportChecksum(r: MigrationReport): string {
  return createHash('sha256').update(JSON.stringify(r.counts) + JSON.stringify(r.issues)).digest('hex').slice(0, 12)
}
