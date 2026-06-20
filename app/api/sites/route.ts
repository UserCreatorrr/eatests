import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Devuelve la lista de centros/locales conocidos del usuario.
// No hay tabla de centros: se derivan de los site_id usados en turnos,
// ventas y merma (texto libre). Sirve para poblar selectores (p.ej. el Daily Brief).
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const rows = db.prepare(`
    SELECT site_id FROM (
      SELECT DISTINCT site_id FROM turnos        WHERE user_id=? AND site_id IS NOT NULL AND TRIM(site_id) <> ''
      UNION SELECT DISTINCT site_id FROM ventas_franja WHERE user_id=? AND site_id IS NOT NULL AND TRIM(site_id) <> ''
      UNION SELECT DISTINCT site_id FROM merma_registro WHERE user_id=? AND site_id IS NOT NULL AND TRIM(site_id) <> ''
    )
    ORDER BY site_id
  `).all(user.id, user.id, user.id) as { site_id: string }[]

  return NextResponse.json({ sites: rows.map(r => r.site_id) })
}
