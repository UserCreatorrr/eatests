// Uso: npx tsx scripts/set-password.ts <ruta.db> <email> <password>
// Cambia la contraseña de un usuario y revoca sus sesiones. Para entornos
// locales o recuperación de cuenta; nunca imprime la contraseña.
import bcrypt from 'bcryptjs'
import { openDatabase } from '@/server/db/connection'

const [file, email, password] = process.argv.slice(2)
if (!file || !email || !password) { console.error('Uso: set-password.ts <ruta.db> <email> <password>'); process.exit(1) }
if (password.length < 8) { console.error('La contraseña necesita al menos 8 caracteres'); process.exit(1) }
const db = openDatabase(file)
const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim()) as { id: string } | undefined
if (!user) { console.error('Usuario no encontrado'); process.exit(1) }
db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), new Date().toISOString(), user.id)
db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(new Date().toISOString(), user.id)
db.close()
console.log(`Contraseña actualizada para ${email}; sesiones anteriores revocadas.`)
