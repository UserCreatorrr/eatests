import { openaiLlm } from '@/server/adapters/openai'
import { route } from '@/server/http/route'
import { matchProposals, matchSchema } from '@/server/services/onboarding'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export const POST = route({ body: matchSchema }, ({ ctx, body }) => matchProposals(ctx, body, openaiLlm))
