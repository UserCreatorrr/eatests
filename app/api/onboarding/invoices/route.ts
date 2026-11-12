import { openaiVision } from '@/server/adapters/openai'
import { route } from '@/server/http/route'
import { imagesSchema, parseInvoices } from '@/server/services/onboarding'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export const POST = route({ body: imagesSchema }, ({ ctx, body }) => parseInvoices(ctx, body, openaiVision))
