import { z } from 'zod'
import { route } from '@/server/http/route'
import { removePushSubscription, savePushSubscription, subscriptionSchema } from '@/server/services/notifications'

export const dynamic = 'force-dynamic'

export const POST = route({ body: subscriptionSchema }, ({ ctx, body }) => { savePushSubscription(ctx, body); return { ok: true } })
export const DELETE = route({ body: z.object({ endpoint: z.string().url() }) }, ({ ctx, body }) => { removePushSubscription(ctx, body.endpoint); return { ok: true } })
