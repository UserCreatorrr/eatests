import { route } from '@/server/http/route'
import { idealShiftForDay, idealShiftSchema } from '@/server/services/labor'

export const dynamic = 'force-dynamic'

export const POST = route({ body: idealShiftSchema }, ({ ctx, body }) => idealShiftForDay(ctx, body))
