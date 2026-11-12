import { route } from '@/server/http/route'
import { sendOrder, sendOrderSchema } from '@/server/services/messaging'

export const dynamic = 'force-dynamic'

// Crea el pedido, lo envia por email o WhatsApp y lo marca enviado.
export const POST = route({ body: sendOrderSchema }, ({ ctx, body }) => sendOrder(ctx, body))
