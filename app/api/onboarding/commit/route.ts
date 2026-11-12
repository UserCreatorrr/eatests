import { route } from '@/server/http/route'
import { commitOnboarding, commitSchema } from '@/server/services/onboarding'

export const dynamic = 'force-dynamic'

export const POST = route({ body: commitSchema }, ({ ctx, body }) => commitOnboarding(ctx, body))
