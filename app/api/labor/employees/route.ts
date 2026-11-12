import { z } from 'zod'
import { route } from '@/server/http/route'
import { createEmployee, employeeSchema, listEmployees } from '@/server/services/labor'

export const dynamic = 'force-dynamic'

export const GET = route({ query: z.object({ all: z.string().optional() }) }, ({ ctx, query }) => ({ data: listEmployees(ctx, { includeInactive: query.all === '1' }) }))
export const POST = route({ body: employeeSchema }, ({ ctx, body }) => createEmployee(ctx, body))
