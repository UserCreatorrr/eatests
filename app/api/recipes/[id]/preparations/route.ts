import { route } from '@/server/http/route'
import { availablePreparations } from '@/server/services/recipes'

export const dynamic = 'force-dynamic'

// Elaboraciones que esta receta puede usar sin crear un ciclo.
export const GET = route({}, ({ ctx, params }) => ({ data: availablePreparations(ctx, params.id === 'new' ? null : Number(params.id)) }))
