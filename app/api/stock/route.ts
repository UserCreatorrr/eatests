import { z } from 'zod'
import { route } from '@/server/http/route'
import { stockLevels } from '@/server/services/stock'

export const dynamic = 'force-dynamic'

export const GET = route({ query: z.object({ warehouseId: z.coerce.number().int().positive().optional() }) }, ({ ctx, query }) => {
  const levels = stockLevels(ctx, { warehouseId: query.warehouseId })
  const warehouses = ctx.db.prepare('SELECT id, name, kind FROM warehouses WHERE org_id = ? AND active = 1 ORDER BY name').all(ctx.orgId)
  return { data: levels, warehouses, totalValue: Math.round(levels.reduce((s, l) => s + l.value, 0) * 100) / 100 }
})
