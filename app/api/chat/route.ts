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
  {
    type: 'function',
    function: {
      name: 'buscar_ingrediente',
      description: 'Busca ingredientes en la base de datos por nombre, tipo o filtros de coste',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Texto a buscar en el nombre (LIKE)' },
          sin_coste: { type: 'boolean', description: 'Si true, devuelve solo los que no tienen coste' },
          tipo: { type: 'string', description: 'Filtrar por tipo de ingrediente' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'actualizar_ingrediente',
      description: 'Actualiza el coste u otros datos de un ingrediente existente',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID del ingrediente' },
          nombre: { type: 'string', description: 'Nombre del ingrediente (para buscarlo si no se tiene el id)' },
          cost: { type: 'number', description: 'Nuevo coste en euros' },
          unit: { type: 'string', description: 'Nueva unidad de medida' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resumen_gastos',
      description: 'Devuelve un resumen de gastos del restaurante por periodo',
      parameters: {
        type: 'object',
        properties: {
          periodo: {
            type: 'string',
            enum: ['hoy', 'esta_semana', 'este_mes', 'mes_anterior', 'este_año'],
            description: 'Periodo de tiempo para el resumen',
          },
        },
        required: ['periodo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_facturas_pendientes',
      description: 'Lista facturas de compra sin pagar, especialmente las que vencen pronto',
      parameters: {
        type: 'object',
        properties: {
          dias: { type: 'number', description: 'Vencen en los proximos X dias. Por defecto 30.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'informe_diario',
      description: 'Genera un briefing completo del estado actual de la cocina',
      parameters: { type: 'object', properties: {} },
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
  if (table) {
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

  if (name === 'buscar_ingrediente') {
    let query = 'SELECT id, descr, type, unit, cost FROM ingredientes WHERE user_id = ?'
    const params: any[] = [userId]
    if (args.nombre) { query += ' AND descr LIKE ?'; params.push('%' + args.nombre + '%') }
    if (args.sin_coste) { query += ' AND (cost IS NULL OR cost = 0)' }
    if (args.tipo) { query += ' AND type LIKE ?'; params.push('%' + args.tipo + '%') }
    query += ' LIMIT 20'
    const rows = db.prepare(query).all(...params)
    if (rows.length === 0) return 'No se encontraron ingredientes con esos criterios.'
    return (rows as any[]).map((r: any) => `• [${r.id}] ${r.descr} | ${r.type || 'N/A'} | ${r.unit || '-'} | ${r.cost ? r.cost + '€' : 'SIN COSTE'}`).join('\n')
  }

  if (name === 'actualizar_ingrediente') {
    let targetId = args.id
    if (!targetId && args.nombre) {
      const found = db.prepare('SELECT id FROM ingredientes WHERE user_id=? AND descr LIKE ? LIMIT 1').get(userId, '%' + args.nombre + '%') as any
      if (!found) return `No encontre ningun ingrediente con nombre "${args.nombre}"`
      targetId = found.id
    }
    if (!targetId) return 'Necesito el id o el nombre del ingrediente para actualizarlo.'
    const updates: string[] = []
    const vals: any[] = []
    if (args.cost !== undefined) { updates.push('cost = ?'); vals.push(args.cost) }
    if (args.unit !== undefined) { updates.push('unit = ?'); vals.push(args.unit) }
    if (updates.length === 0) return 'No se indico ningun campo a actualizar.'
    vals.push(targetId, userId)
    db.prepare(`UPDATE ingredientes SET ${updates.join(', ')} WHERE id=? AND user_id=?`).run(...vals)
    return `Ingrediente ${targetId} actualizado: ${updates.join(', ')}`
  }

  if (name === 'resumen_gastos') {
    const periodos: Record<string, string> = {
      hoy: "date(date_order) = date('now')",
      esta_semana: "date(date_order) >= date('now','weekday 0','-7 days')",
      este_mes: "strftime('%Y-%m', date_order) = strftime('%Y-%m', 'now')",
      mes_anterior: "strftime('%Y-%m', date_order) = strftime('%Y-%m', date('now','-1 month'))",
      'este_año': "strftime('%Y', date_order) = strftime('%Y', 'now')",
    }
    const filtro = periodos[args.periodo] || periodos['este_mes']
    const result = db.prepare(`SELECT COUNT(*) as pedidos, ROUND(SUM(total),2) as total FROM pedidos_compra WHERE user_id=? AND ${filtro}`).get(userId) as any
    const facturas = db.prepare('SELECT COUNT(*) as c, ROUND(SUM(total),2) as t FROM facturas_compra WHERE user_id=? AND paid=0').get(userId) as any
    return `Periodo: ${args.periodo}\nPedidos: ${result.pedidos} | Total gastado: ${result.total || 0}€\nFacturas pendientes de pago: ${facturas.c} (${facturas.t || 0}€)`
  }

  if (name === 'listar_facturas_pendientes') {
    const dias = args.dias || 30
    const rows = db.prepare(`SELECT invoice_num, vendor, total, date_due FROM facturas_compra WHERE user_id=? AND (paid=0 OR paid IS NULL) AND date_due IS NOT NULL AND date_due <= date('now','+${dias} days') ORDER BY date_due ASC LIMIT 15`).all(userId)
    if (rows.length === 0) return `No hay facturas pendientes que venzan en los proximos ${dias} dias.`
    return (rows as any[]).map((f: any) => `• ${f.invoice_num || 'S/N'} | ${f.vendor || '-'} | ${f.total || 0}€ | Vence: ${f.date_due}`).join('\n')
  }

  if (name === 'informe_diario') {
    const hoy = new Date().toISOString().split('T')[0]
    const ingSinCoste = (db.prepare('SELECT COUNT(*) as c FROM ingredientes WHERE user_id=? AND (cost IS NULL OR cost=0)').get(userId) as any).c
    const pedPendEnvio = (db.prepare('SELECT COUNT(*) as c FROM lista_pedidos WHERE user_id=? AND pending_send>0').get(userId) as any).c
    const pedPendRec = (db.prepare('SELECT COUNT(*) as c FROM lista_pedidos WHERE user_id=? AND pending_receive>0').get(userId) as any).c
    const facVencen = db.prepare("SELECT COUNT(*) as c, ROUND(SUM(total),2) as t FROM facturas_compra WHERE user_id=? AND (paid=0 OR paid IS NULL) AND date_due <= date('now','+7 days')").get(userId) as any
    const gastoMes = (db.prepare("SELECT ROUND(SUM(total),2) as t FROM pedidos_compra WHERE user_id=? AND strftime('%Y-%m',date_order)=strftime('%Y-%m','now')").get(userId) as any).t
    return `INFORME DIARIO — ${hoy}\n\n` +
      `Gasto este mes: ${gastoMes || 0}€\n` +
      `Ingredientes sin coste: ${ingSinCoste}\n` +
      `Pedidos pendientes de envio: ${pedPendEnvio}\n` +
      `Pedidos pendientes de recepcion: ${pedPendRec}\n` +
      `Facturas que vencen en 7 dias: ${facVencen.c} (${facVencen.t || 0}€)`
  }

  return 'Herramienta no reconocida'
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
    `• ${o.vendor} | ${o.date_order || '-'} | ${o.total ? o.total + '\u20ac' : '-'}`
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
- Si el usuario quiere crear/anadir algo, usa las herramientas disponibles

HERRAMIENTAS DISPONIBLES ADICIONALES:
- buscar_ingrediente: para consultar ingredientes con filtros
- actualizar_ingrediente: para cambiar precios/unidades de ingredientes
- resumen_gastos: para consultar gasto por periodo (hoy/semana/mes/año)
- listar_facturas_pendientes: para ver facturas que vencen pronto
- informe_diario: genera un briefing completo del estado de la cocina

Cuando el usuario pida "resumen", "informe", "como estamos", "estado general" → usa informe_diario.
Cuando diga "actualiza el precio de X" → usa actualizar_ingrediente.
Cuando pregunte por facturas pendientes o vencimientos → usa listar_facturas_pendientes.`

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
