import { openai } from '@/lib/openai'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getKitchenContext(userId: string) {
  const counts = {
    ingredientes: (db.prepare('SELECT COUNT(*) as c FROM ingredientes WHERE user_id = ?').get(userId) as any)?.c ?? 0,
    proveedores: (db.prepare('SELECT COUNT(*) as c FROM proveedores WHERE user_id = ?').get(userId) as any)?.c ?? 0,
    pedidos: (db.prepare('SELECT COUNT(*) as c FROM pedidos_compra WHERE user_id = ?').get(userId) as any)?.c ?? 0,
    albaranes: (db.prepare('SELECT COUNT(*) as c FROM albaranes_compra WHERE user_id = ?').get(userId) as any)?.c ?? 0,
    herramientas: (db.prepare('SELECT COUNT(*) as c FROM herramientas WHERE user_id = ?').get(userId) as any)?.c ?? 0,
    facturas_pendientes: (db.prepare("SELECT COUNT(*) as c FROM facturas_compra WHERE user_id = ? AND (paid=0 OR paid IS NULL)").get(userId) as any)?.c ?? 0,
  }
  const ingredientes = db.prepare('SELECT id, descr, type, unit, cost FROM ingredientes WHERE user_id = ? ORDER BY descr LIMIT 100').all(userId)
  const proveedores = db.prepare('SELECT id, codi, descr, descr_type, mail, phone FROM proveedores WHERE user_id = ? ORDER BY descr LIMIT 60').all(userId)
  const recentOrders = db.prepare('SELECT num_order, vendor, date_order, total FROM pedidos_compra WHERE user_id = ? ORDER BY date_order DESC LIMIT 10').all(userId)
  return { counts, ingredientes, proveedores, recentOrders }
}

const tools: any[] = [
  // ── INGREDIENTES ──────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'buscar_ingrediente',
      description: 'Busca ingredientes por nombre, tipo o filtra los que no tienen coste',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          sin_coste: { type: 'boolean' },
          tipo: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_ingrediente',
      description: 'Crea un nuevo ingrediente',
      parameters: {
        type: 'object',
        properties: {
          descr: { type: 'string' },
          type: { type: 'string' },
          unit: { type: 'string' },
          cost: { type: 'number' },
          codi: { type: 'string' },
        },
        required: ['descr'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'actualizar_ingrediente',
      description: 'Actualiza precio u otros campos de un ingrediente',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          nombre: { type: 'string', description: 'Nombre para buscar si no hay id' },
          cost: { type: 'number' },
          unit: { type: 'string' },
          type: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'top_ingredientes_coste',
      description: 'Devuelve los N ingredientes más caros o más baratos',
      parameters: {
        type: 'object',
        properties: {
          n: { type: 'number', description: 'Cuántos mostrar (default 10)' },
          orden: { type: 'string', enum: ['mas_caro', 'mas_barato'] },
        },
        required: ['orden'],
      },
    },
  },
  // ── PROVEEDORES ───────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'buscar_proveedor',
      description: 'Busca proveedores por nombre o tipo',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          tipo: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_proveedor',
      description: 'Crea un nuevo proveedor',
      parameters: {
        type: 'object',
        properties: {
          descr: { type: 'string' },
          descr_type: { type: 'string' },
          codi: { type: 'string' },
          mail: { type: 'string' },
          phone: { type: 'string' },
          nif: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
        },
        required: ['descr'],
      },
    },
  },
  // ── ALBARANES ─────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'ver_albaranes_recientes',
      description: 'Lista los últimos albaranes de compra',
      parameters: {
        type: 'object',
        properties: {
          n: { type: 'number', description: 'Cuántos mostrar (default 10)' },
          proveedor: { type: 'string', description: 'Filtrar por proveedor' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guardar_albaran_compra',
      description: 'Guarda un albarán de compra en la base de datos (tras escanear o dictar)',
      parameters: {
        type: 'object',
        properties: {
          vendor: { type: 'string', description: 'Nombre del proveedor' },
          delivery_num: { type: 'string', description: 'Número de albarán' },
          date_delivery: { type: 'string', description: 'Fecha (YYYY-MM-DD)' },
          base: { type: 'number', description: 'Importe base sin IVA' },
          taxes: { type: 'number', description: 'IVA en euros' },
          total: { type: 'number', description: 'Total con IVA' },
          received_by: { type: 'string', description: 'Recibido por' },
          cost_type: { type: 'string' },
          nif: { type: 'string' },
        },
        required: ['vendor'],
      },
    },
  },
  // ── PEDIDOS ───────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'crear_pedido',
      description: 'Crea un pedido de compra',
      parameters: {
        type: 'object',
        properties: {
          num_order: { type: 'string' },
          vendor: { type: 'string' },
          date_order: { type: 'string', description: 'YYYY-MM-DD' },
          total: { type: 'number' },
        },
        required: ['vendor'],
      },
    },
  },
  // ── FACTURAS ──────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'listar_facturas_pendientes',
      description: 'Lista facturas de compra sin pagar que vencen pronto',
      parameters: {
        type: 'object',
        properties: {
          dias: { type: 'number', description: 'Vencen en los próximos X días. Default 30.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guardar_factura_compra',
      description: 'Guarda una factura de compra (tras escanear o dictar)',
      parameters: {
        type: 'object',
        properties: {
          vendor: { type: 'string' },
          invoice_num: { type: 'string' },
          date_invoice: { type: 'string', description: 'YYYY-MM-DD' },
          date_due: { type: 'string', description: 'Fecha de vencimiento YYYY-MM-DD' },
          base: { type: 'number' },
          taxes: { type: 'number' },
          total: { type: 'number' },
          nif: { type: 'string' },
          comment: { type: 'string' },
        },
        required: ['vendor'],
      },
    },
  },
  // ── ANALYTICS ─────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'resumen_gastos',
      description: 'Resumen de gastos del restaurante por periodo',
      parameters: {
        type: 'object',
        properties: {
          periodo: {
            type: 'string',
            enum: ['hoy', 'esta_semana', 'este_mes', 'mes_anterior', 'este_año'],
          },
        },
        required: ['periodo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gasto_por_proveedor',
      description: 'Ranking de gasto total agrupado por proveedor',
      parameters: {
        type: 'object',
        properties: {
          periodo: {
            type: 'string',
            enum: ['este_mes', 'mes_anterior', 'este_año', 'todo'],
            description: 'Default: todo',
          },
          top: { type: 'number', description: 'Cuántos proveedores mostrar. Default 10.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'informe_diario',
      description: 'Briefing completo del estado actual de la cocina',
      parameters: { type: 'object', properties: {} },
    },
  },
]

async function executeTool(name: string, args: any, userId: string): Promise<string> {
  // ── INSERT helpers ─────────────────────────────────────
  const insertMap: Record<string, string> = {
    crear_ingrediente: 'ingredientes',
    crear_proveedor: 'proveedores',
    crear_pedido: 'pedidos_compra',
  }
  if (insertMap[name]) {
    try {
      const { id: _id, user_id: _uid, ...fields } = args
      const columns = ['user_id', ...Object.keys(fields)]
      const values = [userId, ...Object.values(fields)]
      const r = db.prepare(`INSERT INTO ${insertMap[name]} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(...values)
      return `Creado con id ${r.lastInsertRowid}`
    } catch (e: any) { return `Error: ${e.message}` }
  }

  // ── BUSCAR INGREDIENTE ─────────────────────────────────
  if (name === 'buscar_ingrediente') {
    let q = 'SELECT id, descr, type, unit, cost FROM ingredientes WHERE user_id = ?'
    const p: any[] = [userId]
    if (args.nombre) { q += ' AND descr LIKE ?'; p.push('%' + args.nombre + '%') }
    if (args.sin_coste) q += ' AND (cost IS NULL OR cost = 0)'
    if (args.tipo) { q += ' AND type LIKE ?'; p.push('%' + args.tipo + '%') }
    const rows = db.prepare(q + ' LIMIT 25').all(...p) as any[]
    if (!rows.length) return 'No se encontraron ingredientes.'
    return rows.map(r => `• [${r.id}] ${r.descr} | ${r.type || '-'} | ${r.unit || '-'} | ${r.cost ? r.cost + '€' : 'SIN COSTE'}`).join('\n')
  }

  // ── ACTUALIZAR INGREDIENTE ─────────────────────────────
  if (name === 'actualizar_ingrediente') {
    let tid = args.id
    if (!tid && args.nombre) {
      const f = db.prepare('SELECT id FROM ingredientes WHERE user_id=? AND descr LIKE ? LIMIT 1').get(userId, '%' + args.nombre + '%') as any
      if (!f) return `No encontré ingrediente con nombre "${args.nombre}"`
      tid = f.id
    }
    if (!tid) return 'Necesito id o nombre del ingrediente.'
    const updates: string[] = []; const vals: any[] = []
    if (args.cost !== undefined) { updates.push('cost=?'); vals.push(args.cost) }
    if (args.unit !== undefined) { updates.push('unit=?'); vals.push(args.unit) }
    if (args.type !== undefined) { updates.push('type=?'); vals.push(args.type) }
    if (!updates.length) return 'No se indicó ningún campo a actualizar.'
    vals.push(tid, userId)
    db.prepare(`UPDATE ingredientes SET ${updates.join(',')} WHERE id=? AND user_id=?`).run(...vals)
    return `Ingrediente ${tid} actualizado.`
  }

  // ── TOP INGREDIENTES COSTE ─────────────────────────────
  if (name === 'top_ingredientes_coste') {
    const n = args.n || 10
    const orden = args.orden === 'mas_barato' ? 'ASC' : 'DESC'
    const rows = db.prepare(`SELECT descr, unit, cost FROM ingredientes WHERE user_id=? AND cost>0 ORDER BY cost ${orden} LIMIT ?`).all(userId, n) as any[]
    if (!rows.length) return 'No hay ingredientes con coste registrado.'
    return rows.map((r, i) => `${i + 1}. ${r.descr} — ${r.cost}€/${r.unit || 'ud'}`).join('\n')
  }

  // ── BUSCAR PROVEEDOR ───────────────────────────────────
  if (name === 'buscar_proveedor') {
    let q = 'SELECT id, codi, descr, descr_type, mail, phone FROM proveedores WHERE user_id=?'
    const p: any[] = [userId]
    if (args.nombre) { q += ' AND descr LIKE ?'; p.push('%' + args.nombre + '%') }
    if (args.tipo) { q += ' AND descr_type LIKE ?'; p.push('%' + args.tipo + '%') }
    const rows = db.prepare(q + ' LIMIT 20').all(...p) as any[]
    if (!rows.length) return 'No se encontraron proveedores.'
    return rows.map(r => `• [${r.id}] ${r.descr} [${r.descr_type || '-'}] | ${r.mail || ''} | ${r.phone || ''}`).join('\n')
  }

  // ── VER ALBARANES RECIENTES ────────────────────────────
  if (name === 'ver_albaranes_recientes') {
    const n = args.n || 10
    let q = 'SELECT delivery_num, vendor, date_delivery, base, taxes, total FROM albaranes_compra WHERE user_id=?'
    const p: any[] = [userId]
    if (args.proveedor) { q += ' AND vendor LIKE ?'; p.push('%' + args.proveedor + '%') }
    const rows = db.prepare(q + ' ORDER BY date_delivery DESC LIMIT ?').all(...p, n) as any[]
    if (!rows.length) return 'No hay albaranes registrados.'
    return rows.map(r => `• ${r.delivery_num || 'S/N'} | ${r.vendor} | ${r.date_delivery || '-'} | Base: ${r.base || 0}€ | IVA: ${r.taxes || 0}€ | Total: ${r.total || 0}€`).join('\n')
  }

  // ── GUARDAR ALBARÁN COMPRA ─────────────────────────────
  if (name === 'guardar_albaran_compra') {
    try {
      const { id: _id, user_id: _uid, ...fields } = args
      const columns = ['user_id', ...Object.keys(fields)]
      const values = [userId, ...Object.values(fields)]
      const r = db.prepare(`INSERT INTO albaranes_compra (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...values)
      return `Albarán guardado con id ${r.lastInsertRowid}`
    } catch (e: any) { return `Error: ${e.message}` }
  }

  // ── GUARDAR FACTURA COMPRA ─────────────────────────────
  if (name === 'guardar_factura_compra') {
    try {
      const { id: _id, user_id: _uid, ...fields } = args
      const columns = ['user_id', ...Object.keys(fields)]
      const values = [userId, ...Object.values(fields)]
      const r = db.prepare(`INSERT INTO facturas_compra (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...values)
      return `Factura guardada con id ${r.lastInsertRowid}`
    } catch (e: any) { return `Error: ${e.message}` }
  }

  // ── LISTAR FACTURAS PENDIENTES ─────────────────────────
  if (name === 'listar_facturas_pendientes') {
    const dias = args.dias || 30
    const rows = db.prepare(
      `SELECT invoice_num, vendor, total, date_due FROM facturas_compra WHERE user_id=? AND (paid=0 OR paid IS NULL) AND date_due IS NOT NULL AND date_due <= date('now','+${dias} days') ORDER BY date_due ASC LIMIT 15`
    ).all(userId) as any[]
    if (!rows.length) return `No hay facturas pendientes que venzan en ${dias} días.`
    return rows.map(f => `• ${f.invoice_num || 'S/N'} | ${f.vendor || '-'} | ${f.total || 0}€ | Vence: ${f.date_due}`).join('\n')
  }

  // ── RESUMEN GASTOS ─────────────────────────────────────
  if (name === 'resumen_gastos') {
    const filtros: Record<string, string> = {
      hoy: "date(date_order)=date('now')",
      esta_semana: "date(date_order)>=date('now','weekday 0','-7 days')",
      este_mes: "strftime('%Y-%m',date_order)=strftime('%Y-%m','now')",
      mes_anterior: "strftime('%Y-%m',date_order)=strftime('%Y-%m',date('now','-1 month'))",
      'este_año': "strftime('%Y',date_order)=strftime('%Y','now')",
    }
    const f = filtros[args.periodo] || filtros['este_mes']
    const r = db.prepare(`SELECT COUNT(*) as pedidos, ROUND(SUM(total),2) as total FROM pedidos_compra WHERE user_id=? AND ${f}`).get(userId) as any
    const fac = db.prepare("SELECT COUNT(*) as c, ROUND(SUM(total),2) as t FROM facturas_compra WHERE user_id=? AND (paid=0 OR paid IS NULL)").get(userId) as any
    return `Periodo: ${args.periodo}\nPedidos: ${r.pedidos} | Gasto: ${r.total || 0}€\nFacturas pendientes: ${fac.c} (${fac.t || 0}€)`
  }

  // ── GASTO POR PROVEEDOR ────────────────────────────────
  if (name === 'gasto_por_proveedor') {
    const top = args.top || 10
    const filtros: Record<string, string> = {
      este_mes: "AND strftime('%Y-%m',date_order)=strftime('%Y-%m','now')",
      mes_anterior: "AND strftime('%Y-%m',date_order)=strftime('%Y-%m',date('now','-1 month'))",
      'este_año': "AND strftime('%Y',date_order)=strftime('%Y','now')",
      todo: '',
    }
    const f = filtros[args.periodo || 'todo'] ?? ''
    const rows = db.prepare(
      `SELECT vendor, COUNT(*) as pedidos, ROUND(SUM(total),2) as total FROM pedidos_compra WHERE user_id=? ${f} AND vendor IS NOT NULL GROUP BY vendor ORDER BY total DESC LIMIT ?`
    ).all(userId, top) as any[]
    if (!rows.length) return 'No hay datos de pedidos.'
    return rows.map((r, i) => `${i + 1}. ${r.vendor} — ${r.total || 0}€ (${r.pedidos} pedidos)`).join('\n')
  }

  // ── INFORME DIARIO ─────────────────────────────────────
  if (name === 'informe_diario') {
    const hoy = new Date().toISOString().split('T')[0]
    const ingSinCoste = (db.prepare('SELECT COUNT(*) as c FROM ingredientes WHERE user_id=? AND (cost IS NULL OR cost=0)').get(userId) as any).c
    const pedPendEnvio = (db.prepare('SELECT COUNT(*) as c FROM lista_pedidos WHERE user_id=? AND pending_send>0').get(userId) as any).c
    const pedPendRec = (db.prepare('SELECT COUNT(*) as c FROM lista_pedidos WHERE user_id=? AND pending_receive>0').get(userId) as any).c
    const facVencen = db.prepare("SELECT COUNT(*) as c, ROUND(SUM(total),2) as t FROM facturas_compra WHERE user_id=? AND (paid=0 OR paid IS NULL) AND date_due<=date('now','+7 days')").get(userId) as any
    const gastoMes = (db.prepare("SELECT ROUND(SUM(total),2) as t FROM pedidos_compra WHERE user_id=? AND strftime('%Y-%m',date_order)=strftime('%Y-%m','now')").get(userId) as any).t
    const topProv = db.prepare("SELECT vendor, ROUND(SUM(total),2) as t FROM pedidos_compra WHERE user_id=? AND strftime('%Y-%m',date_order)=strftime('%Y-%m','now') GROUP BY vendor ORDER BY t DESC LIMIT 3").all(userId) as any[]
    return `INFORME — ${hoy}\n\n` +
      `Gasto este mes: ${gastoMes || 0}€\n` +
      `Top proveedores mes: ${topProv.map(p => `${p.vendor} (${p.t}€)`).join(', ') || 'sin datos'}\n` +
      `Ingredientes sin coste: ${ingSinCoste}\n` +
      `Pedidos pendientes envío: ${pedPendEnvio}\n` +
      `Pedidos pendientes recepción: ${pedPendRec}\n` +
      `Facturas vencen en 7 días: ${facVencen.c} (${facVencen.t || 0}€)`
  }

  return 'Herramienta no reconocida'
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const { messages, image } = await req.json()
  const ctx = getKitchenContext(user?.id ?? '')

  const ingList = (ctx.ingredientes as any[]).map(i =>
    `• [${i.id}] ${i.descr} [${i.type || '-'}] ${i.unit || ''}${i.cost ? ' ' + i.cost + '€' : ' SIN COSTE'}`
  ).join('\n')

  const provList = (ctx.proveedores as any[]).map(p =>
    `• [${p.id}] ${p.descr} [${p.descr_type || '-'}]`
  ).join('\n')

  const orderList = (ctx.recentOrders as any[]).map(o =>
    `• ${o.vendor} | ${o.date_order || '-'} | ${o.total ? o.total + '€' : '-'}`
  ).join('\n')

  const systemPrompt = `Eres el asistente IA de gestión gastronómica de MarginBite. Tienes acceso completo a todos los datos del restaurante y puedes realizar cualquier acción.

DATOS ACTUALES:
Ingredientes: ${ctx.counts.ingredientes} | Proveedores: ${ctx.counts.proveedores} | Pedidos: ${ctx.counts.pedidos} | Albaranes: ${ctx.counts.albaranes} | Herramientas: ${ctx.counts.herramientas} | Facturas pendientes: ${ctx.counts.facturas_pendientes}

INGREDIENTES (${ctx.counts.ingredientes} total):
${ingList}

PROVEEDORES:
${provList}

ÚLTIMOS PEDIDOS:
${orderList}

REGLAS:
- Responde SIEMPRE en español, directo y concreto
- Usa listas markdown, nunca párrafos largos
- Precios siempre en euros
- FOTO de albarán/factura: extrae TODOS los datos visibles (proveedor, número, fecha, base, IVA, total, productos) en tabla markdown y pregunta si quieres guardarla
- Si el usuario confirma guardar, usa guardar_albaran_compra o guardar_factura_compra
- Para "resumen", "informe", "cómo estamos" → usa informe_diario
- Para análisis de gasto → usa resumen_gastos o gasto_por_proveedor
- Para actualizar precio → usa actualizar_ingrediente
- Cuando crees o modifiques algo, confirma con el id generado`

  const chatMessages: any[] = messages.map((m: any) => ({ role: m.role, content: m.content }))

  // Attach image to last user message
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

  // Use gpt-4o when there's an image, gpt-4o-mini otherwise
  const model = image ? 'gpt-4o' : 'gpt-4o-mini'

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...chatMessages],
    tools,
    tool_choice: 'auto',
    max_tokens: 1500,
    temperature: 0.4,
  })

  const choice = response.choices[0]

  if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
    const results: string[] = []
    for (const tc of choice.message.tool_calls) {
      const args = JSON.parse(tc.function.arguments)
      results.push(await executeTool(tc.function.name, args, user?.id ?? ''))
    }

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
      max_tokens: 600,
      temperature: 0.3,
    })

    const reply = followUp.choices[0]?.message?.content || 'Hecho.'
    const toolNames = choice.message.tool_calls.map((tc: any) => tc.function.name).join(', ')
    return NextResponse.json({ reply, action: toolNames })
  }

  // Streaming response for non-tool calls
  const stream = await openai.chat.completions.create({
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...chatMessages],
    stream: true,
    max_tokens: 1500,
    temperature: 0.4,
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
