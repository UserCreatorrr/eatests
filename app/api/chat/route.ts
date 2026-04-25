import { openai } from '@/lib/openai'
import db from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getKitchenContext(userId: string) {
  const counts = {
    ingredientes:       (db.prepare('SELECT COUNT(*) as c FROM ingredientes WHERE user_id=?').get(userId) as any)?.c ?? 0,
    ing_sin_proveedor:  (db.prepare('SELECT COUNT(*) as c FROM ingredientes WHERE user_id=? AND proveedor_id IS NULL').get(userId) as any)?.c ?? 0,
    proveedores:        (db.prepare('SELECT COUNT(*) as c FROM proveedores WHERE user_id=?').get(userId) as any)?.c ?? 0,
    pedidos:            (db.prepare('SELECT COUNT(*) as c FROM pedidos_compra WHERE user_id=?').get(userId) as any)?.c ?? 0,
    albaranes:          (db.prepare('SELECT COUNT(*) as c FROM albaranes_compra WHERE user_id=?').get(userId) as any)?.c ?? 0,
    facturas_pendientes:(db.prepare("SELECT COUNT(*) as c FROM facturas_compra WHERE user_id=? AND (paid=0 OR paid IS NULL)").get(userId) as any)?.c ?? 0,
  }
  const recentOrders = db.prepare('SELECT vendor, date_order, total FROM pedidos_compra WHERE user_id=? ORDER BY date_order DESC LIMIT 5').all(userId)
  const overdue = (db.prepare("SELECT ROUND(SUM(total),2) as t FROM facturas_compra WHERE user_id=? AND (paid=0 OR paid IS NULL) AND date_due<date('now')").get(userId) as any)?.t ?? 0
  return { counts, recentOrders, overdue }
}

// Tools that don't need a follow-up LLM call — the result IS the answer
const SIMPLE_TOOLS = new Set([
  'crear_ingrediente', 'crear_proveedor', 'crear_pedido',
  'actualizar_ingrediente', 'guardar_albaran_compra', 'guardar_factura_compra',
  'registrar_merma', 'registrar_precio', 'guardar_linea_albaran', 'registrar_produccion',
])

// Lean prompt for follow-up calls (no data lists, saves tokens)
const FOLLOWUP_SYSTEM = 'Asistente de MarginBite. Presenta el resultado de la herramienta al usuario de forma concisa en español. Usa listas markdown si hay varios items. No repitas datos ya formateados — solo añade contexto útil si lo hay.'

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
  // ── MERMA ─────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'registrar_merma',
      description: 'Registra una pérdida o merma de un producto (caducidad, rotura, sobreproducción, pérdida)',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del producto' },
          cantidad: { type: 'number' },
          unidad: { type: 'string' },
          motivo: { type: 'string', enum: ['caducidad', 'sobreproducción', 'rotura', 'pérdida', 'otro'] },
          coste_estimado: { type: 'number', description: 'Coste en euros de la pérdida' },
          fecha: { type: 'string', description: 'YYYY-MM-DD' },
          notas: { type: 'string' },
        },
        required: ['nombre'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_merma',
      description: 'Muestra el resumen de merma/pérdidas por periodo',
      parameters: {
        type: 'object',
        properties: {
          periodo: { type: 'string', enum: ['hoy', 'esta_semana', 'este_mes', 'mes_anterior'] },
          motivo: { type: 'string', description: 'Filtrar por tipo de motivo' },
        },
      },
    },
  },
  // ── PRECIOS Y ALBARANES ───────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'registrar_precio',
      description: 'Registra el precio de un ingrediente/producto (actualiza historial y coste del ingrediente)',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          precio: { type: 'number' },
          unidad: { type: 'string' },
          vendor: { type: 'string' },
          fuente: { type: 'string', enum: ['manual', 'albaran', 'factura'] },
        },
        required: ['nombre', 'precio'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'guardar_linea_albaran',
      description: 'Guarda una línea individual de un albarán escaneado (producto, cantidad, precio unitario)',
      parameters: {
        type: 'object',
        properties: {
          vendor: { type: 'string' },
          nombre: { type: 'string', description: 'Nombre del producto' },
          cantidad: { type: 'number' },
          unidad: { type: 'string' },
          precio_unitario: { type: 'number' },
          total_linea: { type: 'number' },
          fecha: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['nombre'],
      },
    },
  },
  // ── PRODUCCIÓN ────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'registrar_produccion',
      description: 'Registra las raciones producidas de una receta para calcular consumo teórico',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre de la receta' },
          raciones: { type: 'number' },
          fecha: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['nombre', 'raciones'],
      },
    },
  },
  // ── SELECTOR PEDIDO ───────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'selector_pedido',
      description: 'Muestra al usuario la lista de pedidos pendientes de enviar y todos los proveedores para que elija a quién hacer el pedido y por qué canal (email o WhatsApp). Usar cuando el usuario quiere hacer un pedido sin especificar aún el proveedor.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ── SUGERIR ITEMS PEDIDO ──────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'sugerir_items_pedido',
      description: 'Devuelve los ingredientes específicos (con nombre completo, cantidad sugerida y unidad) que se deberían pedir a un proveedor concreto, basándose en el histórico de albaranes y consumo. SIEMPRE usar antes de proponer_pedido_email o proponer_pedido_whatsapp para obtener items reales — nunca inventes nombres genéricos como "carne" o "pescado".',
      parameters: {
        type: 'object',
        properties: {
          proveedor_nombre: { type: 'string', description: 'Nombre del proveedor (ej. "Mercabarna Express SL")' },
        },
        required: ['proveedor_nombre'],
      },
    },
  },
  // ── WHATSAPP PEDIDOS ───────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'proponer_pedido_whatsapp',
      description: 'Genera un mensaje de WhatsApp de pedido a un proveedor para que el usuario lo revise y envíe con un clic. Usar cuando el usuario quiere enviar el pedido por WhatsApp.',
      parameters: {
        type: 'object',
        properties: {
          proveedor_nombre: { type: 'string', description: 'Nombre del proveedor' },
          proveedor_phone:  { type: 'string', description: 'Teléfono del proveedor con prefijo de país, ej: +34645966701' },
          items: {
            type: 'array',
            description: 'Productos a pedir',
            items: {
              type: 'object',
              properties: {
                nombre:   { type: 'string' },
                cantidad: { type: 'number' },
                unidad:   { type: 'string' },
              },
            },
          },
          notas: { type: 'string', description: 'Instrucciones adicionales' },
        },
        required: ['proveedor_nombre', 'items'],
      },
    },
  },
  // ── EMAIL PEDIDOS ──────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'proponer_pedido_email',
      description: 'Genera un borrador de email de pedido a un proveedor para que el usuario lo revise y envíe con un clic',
      parameters: {
        type: 'object',
        properties: {
          proveedor_nombre: { type: 'string', description: 'Nombre del proveedor' },
          proveedor_email: { type: 'string', description: 'Email del proveedor (si se conoce)' },
          items: {
            type: 'array',
            description: 'Productos a pedir',
            items: {
              type: 'object',
              properties: {
                nombre: { type: 'string' },
                cantidad: { type: 'number' },
                unidad: { type: 'string' },
              },
            },
          },
          notas: { type: 'string', description: 'Instrucciones adicionales para el pedido' },
        },
        required: ['proveedor_nombre', 'items'],
      },
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
    const h = new Date().getHours()
    const saludo = h < 13 ? 'Buenos dias' : h < 20 ? 'Buenas tardes' : 'Buenas noches'

    const gastoMes = (db.prepare("SELECT ROUND(SUM(total),2) as t FROM pedidos_compra WHERE user_id=? AND strftime('%Y-%m',date_order)=strftime('%Y-%m','now')").get(userId) as any).t
    const gastoMesAnt = (db.prepare("SELECT ROUND(SUM(total),2) as t FROM pedidos_compra WHERE user_id=? AND strftime('%Y-%m',date_order)=strftime('%Y-%m',date('now','-1 month'))").get(userId) as any).t
    const variacion = gastoMesAnt > 0 ? Math.round(((gastoMes - gastoMesAnt) / gastoMesAnt) * 100) : null
    const topProv = db.prepare("SELECT vendor, ROUND(SUM(total),2) as t FROM pedidos_compra WHERE user_id=? AND strftime('%Y-%m',date_order)=strftime('%Y-%m','now') GROUP BY vendor ORDER BY t DESC LIMIT 3").all(userId) as any[]

    const pedPendEnvio = (db.prepare('SELECT COUNT(*) as c FROM lista_pedidos WHERE user_id=? AND pending_send>0').get(userId) as any).c
    const pedPendRec = (db.prepare('SELECT COUNT(*) as c FROM lista_pedidos WHERE user_id=? AND pending_receive>0').get(userId) as any).c

    const facVencidas = db.prepare("SELECT COUNT(*) as c, ROUND(SUM(total),2) as t FROM facturas_compra WHERE user_id=? AND (paid=0 OR paid IS NULL) AND date_due<date('now')").get(userId) as any
    const facVencen7 = db.prepare("SELECT COUNT(*) as c, ROUND(SUM(total),2) as t FROM facturas_compra WHERE user_id=? AND (paid=0 OR paid IS NULL) AND date_due BETWEEN date('now') AND date('now','+7 days')").get(userId) as any
    const facPendTotal = db.prepare("SELECT COUNT(*) as c, ROUND(SUM(total),2) as t FROM facturas_compra WHERE user_id=? AND (paid=0 OR paid IS NULL)").get(userId) as any

    const ingSinCoste = (db.prepare('SELECT COUNT(*) as c FROM ingredientes WHERE user_id=? AND (cost IS NULL OR cost=0)').get(userId) as any).c
    const mermaMes = db.prepare("SELECT ROUND(SUM(coste_estimado),2) as t, COUNT(*) as n FROM merma_registro WHERE user_id=? AND strftime('%Y-%m',fecha)=strftime('%Y-%m','now')").get(userId) as any
    const topMerma = db.prepare("SELECT nombre, ROUND(SUM(coste_estimado),2) as t FROM merma_registro WHERE user_id=? AND strftime('%Y-%m',fecha)=strftime('%Y-%m','now') GROUP BY nombre ORDER BY t DESC LIMIT 3").all(userId) as any[]

    // Detect price increases: compare latest vs earliest price per ingredient
    const allPrecios = db.prepare(`SELECT nombre, precio, fecha FROM precio_historial WHERE user_id=? ORDER BY nombre, fecha ASC`).all(userId) as any[]
    const precioMap: Record<string, {first: number, last: number}> = {}
    for (const p of allPrecios) {
      if (!precioMap[p.nombre]) precioMap[p.nombre] = { first: p.precio, last: p.precio }
      precioMap[p.nombre].last = p.precio
    }
    const alertasPrecios = Object.entries(precioMap)
      .map(([nombre, v]) => ({ nombre, precio_actual: v.last, precio_anterior: v.first, variacion_pct: v.first > 0 ? Math.round(((v.last - v.first) / v.first) * 100) : 0 }))
      .filter(a => a.variacion_pct > 7)
      .sort((a, b) => b.variacion_pct - a.variacion_pct)
      .slice(0, 4)

    const cards: any[] = []

    // GASTO COMPRAS
    cards.push({
      id: 'gastos',
      titulo: 'Gasto compras',
      icon: 'chart',
      urgencia: variacion !== null && variacion > 15 ? 'warning' : 'normal',
      items: [
        `Este mes: **${gastoMes || 0} EUR**${variacion !== null ? ` (${variacion > 0 ? '+' : ''}${variacion}% vs mes anterior)` : ''}`,
        ...(topProv.length > 0 ? topProv.map(p => `${p.vendor}: ${p.t} EUR`) : ['Sin datos este mes']),
      ],
      acciones: [
        { label: 'Ver analytics', href: '/dashboard/analytics' },
        { label: 'Gasto por proveedor', chat: 'Dame un análisis detallado del gasto por proveedor este mes' },
      ],
    })

    // PEDIDOS
    if (pedPendEnvio > 0 || pedPendRec > 0) {
      cards.push({
        id: 'pedidos',
        titulo: 'Pedidos',
        icon: 'truck',
        urgencia: pedPendEnvio > 0 ? 'warning' : 'normal',
        items: [
          pedPendEnvio > 0 ? `**${pedPendEnvio}** pendientes de enviar` : null,
          pedPendRec > 0 ? `**${pedPendRec}** pendientes de recibir` : null,
        ].filter(Boolean),
        acciones: [
          { label: 'Ver pedidos', href: '/dashboard/compras/pedidos' },
          { label: 'Hacer pedido', chat: 'Quiero hacer un pedido a un proveedor' },
        ],
      })
    }

    // FACTURAS
    cards.push({
      id: 'facturas',
      titulo: 'Facturas pendientes',
      icon: 'invoice',
      urgencia: facVencidas.c > 0 ? 'danger' : facVencen7.c > 0 ? 'warning' : 'normal',
      items: [
        facVencidas.c > 0 ? `**${facVencidas.c} vencidas** · ${facVencidas.t || 0} EUR` : null,
        facVencen7.c > 0 ? `${facVencen7.c} vencen en 7 días · ${facVencen7.t || 0} EUR` : null,
        `Total pendiente: **${facPendTotal.c} facturas** (${facPendTotal.t || 0} EUR)`,
      ].filter(Boolean),
      acciones: [
        { label: 'Ver facturas', href: '/dashboard/compras/facturas' },
        { label: 'Cuáles son urgentes', chat: 'Dime qué facturas están vencidas y cuáles vencen pronto' },
      ],
    })

    // MERMA
    if (mermaMes.n > 0) {
      cards.push({
        id: 'merma',
        titulo: 'Merma este mes',
        icon: 'merma',
        urgencia: mermaMes.t > 100 ? 'warning' : 'normal',
        items: [
          `**${mermaMes.t || 0} EUR** en ${mermaMes.n} eventos`,
          ...topMerma.map(m => `${m.nombre}: ${m.t} EUR`),
        ],
        acciones: [
          { label: 'Ver sangrado', href: '/dashboard/sangrado' },
          { label: 'Registrar merma', chat: 'Quiero registrar una merma' },
          { label: 'Análisis de merma', chat: 'Analiza la merma de este mes y dime cómo reducirla' },
        ],
      })
    }

    // ALERTAS DE PRECIO
    if (alertasPrecios.length > 0) {
      cards.push({
        id: 'precios',
        titulo: 'Alertas de precio',
        icon: 'alert',
        urgencia: 'warning',
        items: alertasPrecios.map(a => `**${a.nombre}**: +${a.variacion_pct}% → ${a.precio_actual} EUR`),
        acciones: [
          { label: 'Ver analytics', href: '/dashboard/analytics' },
          { label: 'Actualizar precios', chat: 'Ayúdame a actualizar los precios de ingredientes que han subido' },
        ],
      })
    }

    // INGREDIENTES SIN COSTE
    if (ingSinCoste > 0) {
      cards.push({
        id: 'sin_coste',
        titulo: 'Ingredientes sin coste',
        icon: 'warning',
        urgencia: 'warning',
        items: [`**${ingSinCoste} ingredientes** sin precio registrado (afecta al escandallo)`],
        acciones: [
          { label: 'Ver ingredientes', href: '/dashboard/ingredientes' },
          { label: 'Cuáles son', chat: 'Dime qué ingredientes no tienen coste registrado' },
        ],
      })
    }

    return `__BRIEF_CARDS__${JSON.stringify({ saludo, fecha: hoy, cards })}`
  }

  // ── REGISTRAR MERMA ───────────────────────────────────────
  if (name === 'registrar_merma') {
    try {
      const { nombre, cantidad, unidad, motivo, coste_estimado, fecha, notas } = args
      const ing = nombre ? db.prepare('SELECT id, cost, unit FROM ingredientes WHERE user_id=? AND descr LIKE ? LIMIT 1').get(userId, '%' + nombre + '%') as any : null
      const coste = coste_estimado ?? (ing && cantidad ? Math.round(ing.cost * cantidad * 100) / 100 : null)
      const r = db.prepare(`INSERT INTO merma_registro (user_id, nombre, ingrediente_id, cantidad, unidad, motivo, coste_estimado, fecha, notas) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(userId, nombre, ing?.id ?? null, cantidad ?? null, unidad ?? ing?.unit ?? null, motivo ?? 'otro', coste ?? null, fecha ?? new Date().toISOString().split('T')[0], notas ?? null)
      return `Merma registrada (id ${r.lastInsertRowid}): ${nombre}${cantidad ? ' · ' + cantidad + ' ' + (unidad || '') : ''}${coste ? ' · ' + coste + '€' : ''}`
    } catch (e: any) { return `Error: ${e.message}` }
  }

  // ── VER MERMA ─────────────────────────────────────────────
  if (name === 'ver_merma') {
    const filtros: Record<string, string> = {
      hoy: "date(fecha)=date('now')",
      esta_semana: "date(fecha)>=date('now','-7 days')",
      este_mes: "strftime('%Y-%m',fecha)=strftime('%Y-%m','now')",
      mes_anterior: "strftime('%Y-%m',fecha)=strftime('%Y-%m',date('now','-1 month'))",
    }
    const f = filtros[args.periodo || 'este_mes']
    let q = `SELECT nombre, cantidad, unidad, motivo, coste_estimado, fecha FROM merma_registro WHERE user_id=? AND ${f}`
    if (args.motivo) q += ` AND motivo=?`
    const params: any[] = [userId]
    if (args.motivo) params.push(args.motivo)
    const rows = db.prepare(q + ' ORDER BY fecha DESC LIMIT 20').all(...params) as any[]
    const total = (db.prepare(`SELECT ROUND(SUM(coste_estimado),2) as t FROM merma_registro WHERE user_id=? AND ${f}`).get(userId) as any).t
    if (!rows.length) return `No hay merma registrada para ${args.periodo || 'este mes'}.`
    return `Merma ${args.periodo || 'este mes'} — Total: ${total || 0}€\n` +
      rows.map(r => `• ${r.nombre} | ${r.cantidad || '?'} ${r.unidad || ''} | ${r.motivo} | ${r.coste_estimado ? r.coste_estimado + '€' : '-'} | ${r.fecha}`).join('\n')
  }

  // ── REGISTRAR PRECIO HISTORIAL ────────────────────────────
  if (name === 'registrar_precio') {
    try {
      const { nombre, vendor, precio, unidad, fuente } = args
      db.prepare(`INSERT INTO precio_historial (user_id, nombre, vendor, precio, unidad, fuente) VALUES (?,?,?,?,?,?)`)
        .run(userId, nombre, vendor ?? null, precio, unidad ?? null, fuente ?? 'manual')
      // Also update ingredientes cost if match found
      const ing = db.prepare('SELECT id FROM ingredientes WHERE user_id=? AND descr LIKE ? LIMIT 1').get(userId, '%' + nombre + '%') as any
      if (ing) db.prepare('UPDATE ingredientes SET cost=? WHERE id=? AND user_id=?').run(precio, ing.id, userId)
      return `Precio registrado: ${nombre} → ${precio}€${unidad ? '/' + unidad : ''}${vendor ? ' (' + vendor + ')' : ''}`
    } catch (e: any) { return `Error: ${e.message}` }
  }

  // ── GUARDAR LÍNEA ALBARÁN ─────────────────────────────────
  if (name === 'guardar_linea_albaran') {
    try {
      const { vendor, nombre, cantidad, unidad, precio_unitario, total_linea, fecha } = args
      db.prepare(`INSERT INTO lineas_albaran_compra (user_id, vendor, nombre, cantidad, unidad, precio_unitario, total_linea, fecha) VALUES (?,?,?,?,?,?,?,?)`)
        .run(userId, vendor ?? null, nombre, cantidad ?? null, unidad ?? null, precio_unitario ?? null, total_linea ?? null, fecha ?? new Date().toISOString().split('T')[0])
      // Register price in history
      if (precio_unitario) {
        db.prepare(`INSERT INTO precio_historial (user_id, nombre, vendor, precio, unidad, fuente) VALUES (?,?,?,?,?,?)`)
          .run(userId, nombre, vendor ?? null, precio_unitario, unidad ?? null, 'albaran')
        const ing = db.prepare('SELECT id FROM ingredientes WHERE user_id=? AND descr LIKE ? LIMIT 1').get(userId, '%' + nombre + '%') as any
        if (ing) db.prepare('UPDATE ingredientes SET cost=? WHERE id=? AND user_id=?').run(precio_unitario, ing.id, userId)
      }
      return `Línea guardada: ${nombre} × ${cantidad || '?'} ${unidad || ''} a ${precio_unitario || '?'}€`
    } catch (e: any) { return `Error: ${e.message}` }
  }

  // ── REGISTRAR PRODUCCIÓN ──────────────────────────────────
  if (name === 'registrar_produccion') {
    try {
      const { nombre, raciones, fecha } = args
      const receta = db.prepare('SELECT id FROM escandallo_receta WHERE user_id=? AND nombre LIKE ? AND activo=1 LIMIT 1').get(userId, '%' + nombre + '%') as any
      db.prepare(`INSERT INTO ventas_produccion (user_id, receta_id, nombre, raciones, fecha) VALUES (?,?,?,?,?)`)
        .run(userId, receta?.id ?? null, nombre, raciones ?? 1, fecha ?? new Date().toISOString().split('T')[0])
      return `Producción registrada: ${nombre} × ${raciones || 1} raciones`
    } catch (e: any) { return `Error: ${e.message}` }
  }

  // ── SELECTOR PEDIDO ──────────────────────────────────────
  if (name === 'selector_pedido') {
    // All proveedores for "pedido suelto" section
    const proveedores = (db.prepare(
      `SELECT id, descr, descr_type, mail, phone, canal_preferido FROM proveedores WHERE user_id=? ORDER BY descr LIMIT 40`
    ).all(userId) as any[])

    // Ingredients that have a supplier assigned → group by proveedor_id
    const ingConProv = (db.prepare(
      `SELECT proveedor_id, proveedor_nombre, descr AS ing_descr, unit, cost
       FROM ingredientes
       WHERE user_id=? AND proveedor_id IS NOT NULL
       ORDER BY proveedor_nombre, descr`
    ).all(userId) as any[])

    const byProvMap: Record<number, { proveedor: any; ingredientes: any[] }> = {}
    for (const ing of ingConProv) {
      if (!byProvMap[ing.proveedor_id]) {
        const prov = (proveedores as any[]).find(p => p.id === ing.proveedor_id) || {
          id: ing.proveedor_id,
          descr: ing.proveedor_nombre,
          descr_type: null, mail: null, phone: null, canal_preferido: null,
        }
        byProvMap[ing.proveedor_id] = { proveedor: prov, ingredientes: [] }
      }
      byProvMap[ing.proveedor_id].ingredientes.push({
        descr: ing.ing_descr,
        unit: ing.unit,
        cost: ing.cost,
      })
    }
    const pedidosPorProveedor = Object.values(byProvMap)

    // Pending lista_pedidos (not yet sent)
    const pendientes = (db.prepare(
      `SELECT id, descr, data, pending_receive FROM lista_pedidos WHERE user_id=? AND pending_send=1 ORDER BY data DESC LIMIT 10`
    ).all(userId) as any[])

    return `__PEDIDO_SELECTOR__${JSON.stringify({ pedidosPorProveedor, pendientes, proveedores })}`
  }

  // ── SUGERIR ITEMS PEDIDO ──────────────────────────────────
  if (name === 'sugerir_items_pedido') {
    const provNombre = (args.proveedor_nombre || '').trim()
    if (!provNombre) return 'Necesito el nombre del proveedor.'

    // Average quantity from last 6 months of albaran lines for this vendor
    const lineas = db.prepare(`
      SELECT nombre, unidad,
             ROUND(AVG(cantidad), 2) AS avg_cant,
             COUNT(*) AS veces,
             MAX(fecha) AS ultima
      FROM lineas_albaran_compra
      WHERE user_id=? AND vendor LIKE ?
      GROUP BY nombre, unidad
      ORDER BY veces DESC, ultima DESC
      LIMIT 15
    `).all(userId, '%' + provNombre + '%') as any[]

    // Fallback: ingredients assigned to this provider (no history yet)
    const asignados = db.prepare(`
      SELECT i.descr AS nombre, i.unit AS unidad, i.cost
      FROM ingredientes i
      JOIN proveedores p ON p.id = i.proveedor_id
      WHERE i.user_id=? AND p.descr LIKE ?
      ORDER BY i.descr
      LIMIT 20
    `).all(userId, '%' + provNombre + '%') as any[]

    if (!lineas.length && !asignados.length) {
      return `No tengo datos de pedidos previos ni ingredientes asignados a "${provNombre}". Pregunta al usuario qué quiere pedir.`
    }

    // Merge: history first (with avg quantities), then assigned ingredients not yet in history
    const seen = new Set(lineas.map(l => l.nombre.toLowerCase()))
    const sugerencias = [
      ...lineas.map(l => ({ nombre: l.nombre, cantidad: l.avg_cant, unidad: l.unidad, fuente: `histórico (${l.veces}x, última ${l.ultima})` })),
      ...asignados.filter(a => !seen.has(a.nombre.toLowerCase())).map(a => ({ nombre: a.nombre, cantidad: null, unidad: a.unidad, fuente: 'asignado (sin histórico)' })),
    ]

    return `Items sugeridos para ${provNombre} (basado en histórico real):\n` +
      sugerencias.map(s => `• ${s.nombre} — ${s.cantidad ?? '?'} ${s.unidad || 'ud'} [${s.fuente}]`).join('\n') +
      `\n\nUSA ESTOS NOMBRES EXACTOS al proponer el pedido. Ajusta cantidades si el usuario lo indica.`
  }

  // ── PROPONER PEDIDO WHATSAPP ──────────────────────────────
  if (name === 'proponer_pedido_whatsapp') {
    const { proveedor_nombre, proveedor_phone, items, notas } = args
    const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const itemLines = (items as any[]).map((i: any) =>
      `• ${i.nombre}${i.cantidad ? ': ' + i.cantidad + (i.unidad ? ' ' + i.unidad : '') : ''}`
    ).join('\n')

    const message = `Hola, soy MarginBites 👋

Pedido para el ${today}:

${itemLines}${notas ? '\n\n' + notas : ''}

Muchas gracias 🙏`

    // Try to find phone in DB if not provided
    let phone = proveedor_phone || ''
    if (!phone && proveedor_nombre) {
      const prov = db.prepare(`SELECT phone FROM proveedores WHERE user_id=? AND descr LIKE ? LIMIT 1`).get(userId, `%${proveedor_nombre}%`) as any
      if (prov?.phone) phone = prov.phone
    }

    return `__WHATSAPP_PROPOSAL__${JSON.stringify({ proveedor: proveedor_nombre, phone, message, items: items || [] })}`
  }

  // ── PROPONER PEDIDO EMAIL ─────────────────────────────────
  if (name === 'proponer_pedido_email') {
    const { proveedor_nombre, proveedor_email, items, notas } = args
    const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const itemLines = (items as any[]).map(i => `  - ${i.nombre}: ${i.cantidad || ''}${i.unidad ? ' ' + i.unidad : ''}`).join('\n')
    const subject = `Pedido ${today} - MarginBites`
    const body = `Estimado equipo de ${proveedor_nombre},

Necesitamos realizar el siguiente pedido para la próxima entrega:

${itemLines}
${notas ? '\nNotas adicionales: ' + notas : ''}

Por favor, confirmen disponibilidad y fecha estimada de entrega.

Muchas gracias,
Equipo MarginBites`

    return `__EMAIL_PROPOSAL__${JSON.stringify({
      proveedor: proveedor_nombre,
      to: proveedor_email || 'pabloperez@visualandgrowth.es',
      subject,
      body,
      items: items || [],
    })}`
  }

  return 'Herramienta no reconocida'
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const { messages, image } = await req.json()
  const ctx = getKitchenContext(user?.id ?? '')

  // ── Lean system prompt — no data dumps, AI uses tools to query ──────────
  const recentStr = (ctx.recentOrders as any[]).map(o =>
    `${o.vendor}/${(o.date_order || '').slice(0, 7)}/${o.total ?? 0}€`
  ).join(' · ') || 'ninguno'

  const systemPrompt = `Eres el asistente IA de MarginBite (restaurante). Tienes herramientas para consultar y modificar todos los datos.

ESTADO HOY:
Ingredientes: ${ctx.counts.ingredientes} (${ctx.counts.ing_sin_proveedor} sin proveedor asignado) | Proveedores: ${ctx.counts.proveedores} | Pedidos: ${ctx.counts.pedidos} | Albaranes: ${ctx.counts.albaranes} | Facturas pendientes: ${ctx.counts.facturas_pendientes}${ctx.overdue > 0 ? ` — ⚠ ${ctx.overdue}€ VENCIDAS` : ''}
Últimos pedidos: ${recentStr}

REGLAS:
- Responde en español, directo y conciso. Listas markdown, nunca párrafos.
- Precios en euros. USA LAS HERRAMIENTAS para consultar datos — no inventes ni adivines.
- FOTO albarán/factura → extrae todo en tabla markdown, pregunta si guardar. Si confirma → guardar_albaran_compra / guardar_factura_compra.
- "resumen/informe/cómo estamos/brief" → informe_diario
- "gasto/cuánto gastamos" → resumen_gastos o gasto_por_proveedor
- "busca/qué ingredientes/cuáles" → buscar_ingrediente
- PEDIDOS — OBLIGATORIO: cualquier intención de pedir sin proveedor concreto → selector_pedido SIEMPRE. Jamás respondas con texto listando proveedores.
- PEDIDO A PROVEEDOR CONCRETO — flujo obligatorio:
  1. Llama a sugerir_items_pedido({proveedor_nombre}) para obtener los ingredientes REALES que ese proveedor suele entregar (con cantidades históricas).
  2. Pasa esa lista TAL CUAL a proponer_pedido_email o proponer_pedido_whatsapp.
- PROHIBIDO usar nombres genéricos ("carne", "pescado", "verduras", "fruta") en items de pedido. SIEMPRE nombres específicos del catálogo: "Salmón fresco (lomo)", "Solomillo de ternera", "Tomate rama madurado", etc. Si dudas, llama a buscar_ingrediente o sugerir_items_pedido.
- Pregunta al usuario por canal preferido (email o WhatsApp) si no lo indica. WhatsApp INTEGRADO — SÍ PUEDES. Jamás digas que no puedes.`

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

  const model = image ? 'gpt-4o' : 'gpt-4o-mini'

  // ── Single API call — handles both tool detection and content ────────────
  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...chatMessages],
    tools,
    tool_choice: 'auto',
    max_tokens: 1500,
    temperature: 0.4,
  })

  const choice = response.choices[0]

  // ── Non-tool response: return directly — no second API call ─────────────
  if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls) {
    const reply = choice.message.content || ''
    return NextResponse.json({ reply })
  }

  // ── Tool execution ───────────────────────────────────────────────────────
  const toolCalls = choice.message.tool_calls
  const toolNames = toolCalls.map((tc: any) => tc.function.name).join(', ')
  const results: string[] = []
  let emailProposal: any = null
  let whatsappProposal: any = null
  let briefCards: any = null
  let pedidoSelector: any = null

  for (const tc of toolCalls) {
    const args = JSON.parse(tc.function.arguments)
    const result = await executeTool(tc.function.name, args, user?.id ?? '')
    if (result.startsWith('__EMAIL_PROPOSAL__')) {
      emailProposal = JSON.parse(result.slice('__EMAIL_PROPOSAL__'.length))
      results.push('Propuesta de email generada.')
    } else if (result.startsWith('__WHATSAPP_PROPOSAL__')) {
      whatsappProposal = JSON.parse(result.slice('__WHATSAPP_PROPOSAL__'.length))
      results.push('Propuesta de WhatsApp generada.')
    } else if (result.startsWith('__BRIEF_CARDS__')) {
      briefCards = JSON.parse(result.slice('__BRIEF_CARDS__'.length))
      results.push('Brief generado.')
    } else if (result.startsWith('__PEDIDO_SELECTOR__')) {
      pedidoSelector = JSON.parse(result.slice('__PEDIDO_SELECTOR__'.length))
      results.push('Selector de pedido generado.')
    } else {
      results.push(result)
    }
  }

  // Visual cards → return immediately, no follow-up needed
  if (briefCards)     return NextResponse.json({ reply: '', action: toolNames, briefCards })
  if (pedidoSelector) return NextResponse.json({ reply: '', action: toolNames, pedidoSelector })
  if (whatsappProposal) return NextResponse.json({ reply: '', action: toolNames, whatsappProposal })

  // Simple CRUD tools → return result directly, no follow-up LLM call
  const allSimple = toolCalls.every((tc: any) => SIMPLE_TOOLS.has(tc.function.name))
  if (allSimple) {
    const reply = results.join('\n')
    return NextResponse.json({ reply, action: toolNames, emailProposal })
  }

  // Analytical tools → follow-up with lean system prompt (not the full context)
  const followUp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: FOLLOWUP_SYSTEM },
      ...chatMessages,
      choice.message,
      ...toolCalls.map((tc: any, i: number) => ({
        role: 'tool' as const,
        tool_call_id: tc.id,
        content: results[i] || 'ok',
      })),
    ],
    max_tokens: 500,
    temperature: 0.2,
  })

  const reply = followUp.choices[0]?.message?.content || results.join('\n')
  return NextResponse.json({ reply, action: toolNames, emailProposal })
}
