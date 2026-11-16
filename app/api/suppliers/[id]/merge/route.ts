import { z } from 'zod'
import { route } from '@/server/http/route'
import { mergeSuppliers } from '@/server/services/catalog'

export const dynamic = 'force-dynamic'

// Absorbe la ficha `fromId` en esta (mismo proveedor dado de alta dos veces).
export const POST = route({ body: z.object({ fromId: z.number().int().positive() }) }, ({ ctx, params, body }) => mergeSuppliers(ctx, Number(params.id), body.fromId))
