// Limpieza única de los duplicados que dejó la v1 (diagnóstico de Steven, 24-sep, P2:
// "script de limpieza de los duplicados actuales de Connatura") y del Makro con el NIF
// mal leído. Usa los mismos servicios que la app (con sus reglas y su auditoría).
//
//   npx tsx scripts/oneoff/2026-11-16-limpieza-duplicados.ts <bd>            ensayo, no escribe
//   npx tsx scripts/oneoff/2026-11-16-limpieza-duplicados.ts <bd> --apply    aplica, todo o nada
//
// Cada paso comprueba antes que el registro es el esperado (número, proveedor,
// estado); si algo no coincide, se aborta sin tocar nada.
import { openDatabase } from '@/server/db/connection'
import type { Ctx } from '@/server/http/context'
import { getSupplier, mergeSuppliers } from '@/server/services/catalog'
import { deleteDeliveryNote, deleteInvoice, getDeliveryNote, getInvoice, setInvoicePaid, updateDeliveryNote } from '@/server/services/purchasing'

const [file, flag] = process.argv.slice(2)
if (!file) { console.error('Uso: limpieza-duplicados.ts <bd> [--apply]'); process.exit(1) }
const apply = flag === '--apply'
const db = openDatabase(file)

function ctxFor(email: string): Ctx {
  const r = db.prepare(`SELECT u.id user_id, m.org_id FROM users u JOIN memberships m ON m.user_id = u.id WHERE u.email = ?`).get(email) as any
  if (!r) throw new Error(`No existe la cuenta ${email}`)
  return { db, userId: r.user_id, email, orgId: r.org_id, role: 'owner', sessionId: 'limpieza-2026-11-16' }
}
function expect(cond: boolean, what: string) { if (!cond) throw new Error(`Comprobación fallida, no se toca nada: ${what}`) }

const steps: { desc: string; run: () => void }[] = []
const step = (desc: string, run: () => void) => steps.push({ desc, run })

// ── hello@marginbite.com: Makro dado de alta dos veces (NIF A28647541 es errata de A28647451)
const hello = ctxFor('hello@marginbite.com')
{
  const empty = getDeliveryNote(hello, 225), scan = getDeliveryNote(hello, 226), orphan = getDeliveryNote(hello, 229)
  expect(empty.number === '019/201 3009' && empty.lines.length === 0 && empty.status === 'draft', 'albarán 225 es la cabecera vacía 019/201 3009')
  expect(scan.number === '019/201 3009 (dup 101)' && scan.lines.length === 10 && scan.image_id != null, 'albarán 226 es el escaneo con 10 líneas e imagen')
  expect(orphan.number === 'ALB-LEGACY-20241114-22' && orphan.status === 'draft' && orphan.delivery_date === scan.delivery_date, 'albarán 229 son las líneas sueltas del mismo día')
  const keep = getSupplier(hello, 18), drop = getSupplier(hello, 22)
  expect(keep.tax_id === 'A28647451' && drop.tax_id === 'A28647541' && /makro/i.test(drop.name), 'proveedores 18 y 22 son los dos Makro')
  step('hello · borrar 019/201 3009 vacío (225): cabecera sin líneas, el escaneo bueno es el 226', () => deleteDeliveryNote(hello, 225))
  step('hello · borrar ALB-LEGACY-20241114-22 (229): las mismas líneas sueltas del escaneo 226', () => deleteDeliveryNote(hello, 229))
  step('hello · el escaneo 226 recupera su número 019/201 3009', () => updateDeliveryNote(hello, 226, { number: '019/201 3009' }))
  step('hello · fusionar "Makro Distribucion Mayorista" (NIF errata) en "Makro"', () => mergeSuppliers(hello, 18, 22))
}

// ── connaturafood18: duplicados de las pruebas de QA de Steven
const conn = ctxFor('connaturafood18@gmail.com')
{
  const orig3 = getDeliveryNote(conn, 236), dup3 = getDeliveryNote(conn, 237), dup2 = getDeliveryNote(conn, 238)
  expect(orig3.number === 'ALB-QA-003' && orig3.status === 'validated', 'albarán 236 es el ALB-QA-003 validado')
  expect(dup3.number === 'ALB-QA-003 (dup 107)' && dup3.total_cents === orig3.total_cents && dup3.delivery_date === orig3.delivery_date && dup3.lines.length === 1, '237 es copia idéntica de 236')
  expect(dup2.number === 'ALB-QA-002 (dup 108)' && dup2.lines.length === 0 && dup2.status === 'review', '238 es un ALB-QA-002 repetido y vacío')
  const misread = getInvoice(conn, 20), fakeDup = getInvoice(conn, 21)
  expect(misread.number === 'ALB-QA-003' && misread.status === 'pending' && misread.deliveryNotes.length === 0, 'factura 20 es el albarán ALB-QA-003 leído como factura (bug #1)')
  expect(fakeDup.number === 'FAC-20260814-001 (dup 113)' && fakeDup.total_cents === 100000 && fakeDup.deliveryNotes.length === 0, 'factura 21 es el duplicado de prueba de 1.000 €')
  const keep = getSupplier(conn, 25), drop = getSupplier(conn, 26)
  expect(keep.name === 'Proveedor QA Connatura' && drop.name === 'QA Connatura', 'proveedores 25 y 26 son el mismo proveedor de QA')
  step('connatura · borrar ALB-QA-003 (dup 107): copia idéntica del validado', () => deleteDeliveryNote(conn, 237))
  step('connatura · borrar ALB-QA-002 (dup 108): repetido y sin líneas', () => deleteDeliveryNote(conn, 238))
  step('connatura · borrar la "factura" ALB-QA-003 (era el albarán escaneado como factura, bug #1)', () => deleteInvoice(conn, 20))
  step('connatura · borrar FAC-20260814-001 (dup 113): prueba de 1.000 € con el número de otra factura', () => { setInvoicePaid(conn, 21, false); deleteInvoice(conn, 21) })
  step('connatura · fusionar "QA Connatura" en "Proveedor QA Connatura" (mismo proveedor)', () => mergeSuppliers(conn, 25, 26))
}

const spend = (c: Ctx) => (db.prepare('SELECT COUNT(*) n, COALESCE(SUM(total_cents),0)/100.0 t FROM invoices WHERE org_id = ?').get(c.orgId) as any)
console.log(`Gasto antes · hello: ${JSON.stringify(spend(hello))} · connatura: ${JSON.stringify(spend(conn))}`)
for (const s of steps) console.log(`${apply ? '✓' : '·'} ${s.desc}`)
if (!apply) { console.log('\nEnsayo: no se ha escrito nada. Repite con --apply.'); process.exit(0) }
db.transaction(() => { for (const s of steps) s.run() })()
console.log(`Gasto después · hello: ${JSON.stringify(spend(hello))} · connatura: ${JSON.stringify(spend(conn))}`)
console.log('integridad:', db.pragma('integrity_check', { simple: true }), '· claves rotas:', (db.pragma('foreign_key_check') as any[]).length)
db.close()
