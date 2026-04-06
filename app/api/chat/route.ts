import { openai } from '@/lib/openai'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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

const tools: any[] = [
  {
    type: 'function',
    function: {
      name: 'crear_ingrediente',
      description: 'Crea un nuevo ingrediente en la base de datos del restaurante',
      parameters: {
        type: 'object',
        properties: {
          descr: { type: 'string', description: 'Nombre del ingrediente' },
          type: { type: 'string', description: 'Tipo de ingrediente' },
          unit: { type: 'string', description: 'Unidad de medida (kg, l, ud, etc)' },
          cost: { type: 'number', description: 'Coste en euros' },
          codi: { type: 'string', description: 'Codigo interno' },
        },
        required: ['descr'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_proveedor',
      description: 'Crea un nuevo proveedor en la base de datos',
      parameters: {
        type: 'object',
        properties: {
          descr: { type: 'string', description: 'Nombre del proveedor' },
          descr_type: { type: 'string', description: 'Tipo de proveedor' },
          codi: { type: 'string', description: 'Codigo interno' },
        },
        required: ['descr'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_pedido',
      description: 'Crea un nuevo pedido de compra',
      parameters: {
        type: 'object',
        properties: {
          num_order: { type: 'string', description: 'Numero de pedido' },
          vendor: { type: 'string', description: 'Nombre del proveedor' },
          date_order: { type: 'string', description: 'Fecha del pedido (YYYY-MM-DD)' },
          total: { type: 'number', description: 'Importe total en euros' },
        },
        required: ['vendor'],
      },
    },
  },
]

async function executeTool(name: string, args: any, userId: string): Promise<string> {
  const tableMap: Record<string, string> = {
    crear_ingrediente: 'ingredientes',
    crear_proveedor: 'proveedores',
    crear_pedido: 'pedidos_compra',
    crear_herramienta: 'herramientas',
    crear_albaran: 'albaranes_compra',
  }
  const table = tableMap[name]
  if (!table) return 'Herramienta no reconocida'

  try {
    const { id: _id, user_id: _uid, ...fields } = args
    const columns = ['user_id', ...Object.keys(fields)]
    const values = [userId, ...Object.values(fields)]
    const placeholders = columns.map(() => '?').join(', ')
    const result = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...values)
    return `Creado en ${table} con id ${result.lastInsertRowid}`
  } catch (e: any) {
    return `Error: ${e.message}`
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const { messages, image } = await req.json()
  const ctx = getKitchenContext(user?.id ?? '')

  const ingList = (ctx.ingredientes as any[]).map(i =>
    `• ${i.descr} [${i.type || 'N/A'}] ${i.unit || ''}${i.cost ? ' - ' + i.cost + '\u20ac' : ' - sin coste'}`
  ).join('\n')

  const provList = (ctx.proveedores as any[]).map(p =>
    `• ${p.codi || ''} ${p.descr} [${p.descr_type || 'N/A'}]`
  ).join('\n')

  const orderList = (ctx.recentOrders as any[]).map(o =>
    `• ${o.vendor} | ${o.date_order} | ${o.total ? o.total + '\u20ac' : '-'}`
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
- Precios en euros
- Si el usuario quiere crear/anadir algo, usa las herramientas disponibles`

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

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: systemPrompt }, ...chatMessages],
    tools,
    tool_choice: 'auto',
    max_tokens: 1200,
    temperature: 0.5,
  })

  const choice = response.choices[0]

  // Handle function calls
  if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
    const results: string[] = []
    for (const toolCall of choice.message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments)
      const result = await executeTool(toolCall.function.name, args, user?.id ?? '')
      results.push(`${toolCall.function.name}: ${result}`)
    }

    // Get a follow-up reply from the model
    const followUp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...chatMessages,
        choice.message,
        ...choice.message.tool_calls.map((tc: any, i: number) => ({
          role: 'tool' as const,
          tool_call_id: tc.id,
          content: results[i] || 'ok',
        })),
      ],
      max_tokens: 400,
      temperature: 0.3,
    })

    const reply = followUp.choices[0]?.message?.content || 'Hecho.'
    const toolNames = choice.message.tool_calls.map((tc: any) => tc.function.name).join(', ')

    return NextResponse.json({ reply, action: toolNames })
  }

  // Normal streaming response
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
