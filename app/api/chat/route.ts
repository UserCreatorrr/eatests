import { openai } from '@/lib/openai'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { NextRequest } from 'next/server'

function getKitchenContext(userId: string) {
  const nIngredientes = (db.prepare('SELECT COUNT(*) as c FROM ingredientes WHERE user_id = ?').get(userId) as any)?.c ?? 0
  const nProveedores = (db.prepare('SELECT COUNT(*) as c FROM proveedores WHERE user_id = ?').get(userId) as any)?.c ?? 0
  const nPedidos = (db.prepare('SELECT COUNT(*) as c FROM pedidos_compra WHERE user_id = ?').get(userId) as any)?.c ?? 0
  const nAlbaranes = (db.prepare('SELECT COUNT(*) as c FROM albaranes_compra WHERE user_id = ?').get(userId) as any)?.c ?? 0
  const nHerramientas = (db.prepare('SELECT COUNT(*) as c FROM herramientas WHERE user_id = ?').get(userId) as any)?.c ?? 0

  const ingredientes = db.prepare('SELECT descr, type, unit, cost FROM ingredientes WHERE user_id = ? ORDER BY descr LIMIT 80').all(userId)
  const proveedores = db.prepare('SELECT codi, descr, descr_type FROM proveedores WHERE user_id = ? ORDER BY descr LIMIT 40').all(userId)
  const recentOrders = db.prepare('SELECT num_order, vendor, date_order, total FROM pedidos_compra WHERE user_id = ? ORDER BY date_order DESC LIMIT 10').all(userId)

  return {
    counts: { nIngredientes, nProveedores, nPedidos, nAlbaranes, nHerramientas },
    ingredientes,
    proveedores,
    recentOrders,
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const { messages, image } = await req.json()
  const ctx = getKitchenContext(user?.id ?? '')

  const ingList = (ctx.ingredientes as any[]).map(i =>
    `• ${i.descr} [${i.type || 'N/A'}] ${i.unit || ''}${i.cost ? ' - ' + i.cost + '€' : ' - sin coste'}`
  ).join('\n')

  const provList = (ctx.proveedores as any[]).map(p =>
    `• ${p.codi || ''} ${p.descr} [${p.descr_type || 'N/A'}]`
  ).join('\n')

  const orderList = (ctx.recentOrders as any[]).map(o =>
    `• ${o.vendor} | ${o.date_order} | ${o.total ? o.total + '€' : '-'}`
  ).join('\n')

  const systemPrompt = `Eres el asistente de cocina IA de un restaurante profesional. Ayudas con la gestion diaria: ingredientes, pedidos, albaranes, costes.

DATOS ACTUALES:
Ingredientes: ${ctx.counts.nIngredientes} | Proveedores: ${ctx.counts.nProveedores} | Pedidos: ${ctx.counts.nPedidos} | Albaranes: ${ctx.counts.nAlbaranes} | Herramientas: ${ctx.counts.nHerramientas}

INGREDIENTES:
${ingList}

PROVEEDORES:
${provList}

ULTIMOS PEDIDOS:
${orderList}

REGLAS:
- Responde SIEMPRE en espanol, directo y practico
- FOTO de albaran: extrae proveedor, productos, cantidades y precios en tabla markdown
- Nota de voz: confirma lo que entendiste y ofrece acciones
- Sugiere cantidades de pedido basandote en historico
- Usa listas y formato claro, nunca parrafos largos
- Precios en euros`

  const chatMessages: any[] = messages.map((m: any) => ({ role: m.role, content: m.content }))

  if (image && chatMessages.length > 0 && chatMessages.at(-1)?.role === 'user') {
    const last = chatMessages[chatMessages.length - 1]
    chatMessages[chatMessages.length - 1] = {
      role: 'user',
      content: [
        { type: 'text', text: last.content || 'Analiza esta imagen' },
        { type: 'image_url', image_url: { url: image, detail: 'high' } },
      ],
    }
  }

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: systemPrompt }, ...chatMessages],
    stream: true,
    max_tokens: 1200,
    temperature: 0.5,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || ''
        if (text) controller.enqueue(encoder.encode(text))
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
  })
}
