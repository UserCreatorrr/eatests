import { openaiVision } from '@/server/adapters/openai'
import { route } from '@/server/http/route'
import { imagesSchema, parseMenu } from '@/server/services/onboarding'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const POST = route({ body: imagesSchema }, ({ ctx, body }) => parseMenu(ctx, body, openaiVision))
