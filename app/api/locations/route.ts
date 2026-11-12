import { route } from '@/server/http/route'
import { createLocation, listLocations, locationSchema } from '@/server/services/labor'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx }) => ({ data: listLocations(ctx) }))
export const POST = route({ body: locationSchema }, ({ ctx, body }) => createLocation(ctx, body))
