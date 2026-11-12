import { route } from '@/server/http/route'

export const dynamic = 'force-dynamic'

export const GET = route({}, () => ({ publicKey: process.env.VAPID_PUBLIC_KEY || '' }))
