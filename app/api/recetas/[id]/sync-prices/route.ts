import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const lineas = db.prepare(`
    SELECT l.id, i.cost as live_cost
    FROM escandallo_lineas l
    JOIN ingredientes i ON i.id = l.ingrediente_id
    WHERE l.receta_id = ? AND l.user_id = ? AND l.ingrediente_id IS NOT NULL AND i.cost IS NOT NULL AND i.cost > 0
  `).all(params.id, user.id) as { id: number; live_cost: number }[]

  const update = db.prepare('UPDATE escandallo_lineas SET coste_unitario = ? WHERE id = ?')
  const tx = db.transaction((rows: typeof lineas) => {
    for (const row of rows) update.run(row.live_cost, row.id)
  })
  tx(lineas)

  return NextResponse.json({ updated: lineas.length })
}
