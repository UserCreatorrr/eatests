// Uso: npx tsx scripts/migrate-v1.ts <v1.db> <v2.db> [informe.json]
// Lee la BD v1 en solo lectura y escribe una v2 nueva. Imprime el informe.
import fs from 'fs'
import { migrateV1, reportChecksum } from '@/server/legacy/migrate-v1'

const [,, src, dst, out] = process.argv
if (!src || !dst) { console.error('Uso: migrate-v1 <v1.db> <v2.db> [informe.json]'); process.exit(2) }
if (fs.existsSync(dst)) { console.error(`Destino ya existe: ${dst}. Bórralo o elige otro nombre.`); process.exit(2) }

const t0 = Date.now()
const report = migrateV1(src, dst)
const ms = Date.now() - t0

console.log(`\nMigración v1 → v2 en ${ms} ms · ${report.users} usuarios → ${report.orgs} organizaciones\n`)
console.log('tabla'.padEnd(24) + 'leídas'.padStart(8) + 'escritas'.padStart(10))
for (const [t, c] of Object.entries(report.counts)) console.log(t.padEnd(24) + String(c.read).padStart(8) + String(c.written).padStart(10))
const byKind = new Map<string, number>()
for (const i of report.issues) byKind.set(`${i.table}: ${i.action}`, (byKind.get(`${i.table}: ${i.action}`) ?? 0) + 1)
console.log(`\n${report.issues.length} incidencias:`)
for (const [k, n] of Array.from(byKind.entries()).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`)
console.log(`\nchecksum del informe: ${reportChecksum(report)}`)
if (out) { fs.writeFileSync(out, JSON.stringify(report, null, 2)); console.log(`informe completo en ${out}`) }
