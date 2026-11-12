import { route } from '@/server/http/route'
import { importCsv, importSchema, SALES_FIELDS, SHIFT_FIELDS } from '@/server/services/labor'

export const dynamic = 'force-dynamic'

// Campos admitidos, para que el mapeador del CSV los ofrezca.
export const GET = route({}, () => ({ shifts: SHIFT_FIELDS, sales: SALES_FIELDS }))
export const POST = route({ body: importSchema }, ({ ctx, body }) => importCsv(ctx, body))
