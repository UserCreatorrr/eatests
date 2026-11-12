import { route } from '@/server/http/route'
import { deactivateEmployee, employeeSchema, getEmployee, updateEmployee } from '@/server/services/labor'

export const dynamic = 'force-dynamic'

export const GET = route({}, ({ ctx, params }) => getEmployee(ctx, Number(params.id)))
export const PATCH = route({ body: employeeSchema.partial() }, ({ ctx, params, body }) => updateEmployee(ctx, Number(params.id), body))
export const DELETE = route({}, ({ ctx, params }) => { deactivateEmployee(ctx, Number(params.id)); return { ok: true } })
