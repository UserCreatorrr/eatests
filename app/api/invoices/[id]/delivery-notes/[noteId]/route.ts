import { route } from '@/server/http/route'
import { detachDeliveryNote } from '@/server/services/purchasing'

export const dynamic = 'force-dynamic'

export const DELETE = route({}, ({ ctx, params }) => { detachDeliveryNote(ctx, Number(params.id), Number(params.noteId)); return { ok: true } })
