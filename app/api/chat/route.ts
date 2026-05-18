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
      description: 'Briefing completo del estado actual del negocio: facturas, pedidos, merma, precios, food cost',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pedidos_pendientes_recibir',
      description: 'Lista los pedidos/listas de pedido pendientes de confirmar recepción',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'alertas_subida_precio',
      description: 'Muestra los ingredientes cuyo precio ha subido significativamente comparando primero y último registro',
      parameters: {
        type: 'object',
        properties: {
          umbral_pct: { type: 'number', description: 'Porcentaje mínimo de subida. Default 10.' },
        },
      },
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
  // ── GUARDAR ALBARÁN COMPLETO ──────────────────────────────
  {
    type: 'function',
    function: {
      name: 'guardar_albaran_completo',
      description: 'Guarda un albarán de compra completo: cabecero + todas las líneas de producto en una sola operación. USAR SIEMPRE al escanear un albarán con foto en vez de guardar_albaran_compra + múltiples guardar_linea_albaran por separado. Extrae TODOS los artículos de la imagen.',
      parameters: {
        type: 'object',
        properties: {
          vendor:         { type: 'string' },
          delivery_num:   { type: 'string' },
          date_delivery:  { type: 'string', description: 'YYYY-MM-DD' },
          base:           { type: 'number' },
          taxes:          { type: 'number' },
          total:          { type: 'number' },
          nif:            { type: 'string' },
          lineas: {
            type: 'array',
            description: 'Todos los artículos del albarán',
            items: {
              type: 'object',
              properties: {
                nombre:          { type: 'string' },
                cantidad:        { type: 'number' },
                unidad:          { type: 'string' },
                precio_unitario: { type: 'number' },
                total_linea:     { type: 'number' },
              },
              required: ['nombre'],
            },
          },
        },
        required: ['vendor'],
      },
    },
  },
  // ── INFORME SEMANAL ───────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'informe_semanal',
      description: 'Genera el informe de la semana pasada: gasto de compras vs semana anterior, merma, food cost de recetas, facturas pendientes y subidas de precio. Usar los lunes o cuando el usuario pida el resumen semanal.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ── FACTURAS PAGAR ────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'listar_facturas_para_pagar',
      description: 'Muestra todas las facturas de compra pendientes de pago como una tarjeta interactiva donde el usuario puede marcar cada una como pagada con un clic. Usar cuando el usuario quiera ver, gestionar o pagar facturas pendientes.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'marcar_factura_pagada',
      description: 'Marca una o varias facturas como pagadas directamente desde el chat, buscando por proveedor, número de factura o ambos. Usar cuando el usuario diga "he pagado", "marca como pagada", "ya pagué a X".',
      parameters: {
        type: 'object',
        properties: {
          vendor: { type: 'string', description: 'Nombre del proveedor (parcial)' },
          invoice_num: { type: 'string', description: 'Número de factura exacto' },
          todas: { type: 'boolean', description: 'Si true, marca TODAS las facturas pendientes como pagadas' },
        },
      },
    },
  },
  // ── COMPARAR PRECIOS PROVEEDOR ────────────────────────────
  {
    type: 'function',
    function: {
      name: 'comparar_precios_proveedor',
      description: 'Compara el precio de un ingrediente entre todos los proveedores que lo han suministrado, usando el último precio registrado de cada uno. Si no se indica nombre, muestra los ingredientes con mayor diferencia de precio entre proveedores. Usar cuando el usuario pregunte quién cobra más barato, comparativa de precios, ahorro potencial, etc.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del ingrediente a comparar. Opcional — si se omite muestra los top oportunidades.' },
          top: { type: 'number', description: 'Cuántos ingredientes mostrar cuando nombre es null. Default 8.' },
        },
      },
    },
  },
  // ── FOOD COST ANÁLISIS ────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'analizar_food_cost_recetas',
      description: 'Analiza el food cost actual de todas las recetas activas usando precios reales. Identifica las que están por encima del umbral y sugiere ajustes de precio de venta. Usar cuando el usuario pregunte por rentabilidad de platos, food cost alto, qué platos revisar, etc.',
      parameters: {
        type: 'object',
        properties: {
          umbral_pct: { type: 'number', description: 'Umbral de food cost % para alertar. Default 33.' },
        },
      },
    },
  },
  // ── COMPRA SEMANAL ────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'calcular_compra_semanal',
      description: 'Calcula la lista de la compra necesaria para producir una serie de platos durante la semana, basándose en los escandallos. Escala cantidades por raciones, aplica merma y agrupa por proveedor con coste estimado. USAR cuando el usuario diga cuántas raciones va a hacer de cada plato esta semana o quiera planificar la producción.',
      parameters: {
        type: 'object',
        properties: {
          platos: {
            type: 'array',
            description: 'Lista de platos con sus raciones planificadas',
            items: {
              type: 'object',
              properties: {
                nombre: { type: 'string', description: 'Nombre del plato (se busca en el escandallo)' },
                raciones: { type: 'number', description: 'Número de raciones a producir' },
              },
              required: ['nombre', 'raciones'],
            },
          },
        },
        required: ['platos'],
      },
    },
  },
  // ── HISTORIAL PRECIO ──────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'historial_precio_ingrediente',
      description: 'Muestra la evolución del precio de un ingrediente a lo largo del tiempo como gráfico de línea. Usar cuando el usuario pregunta cómo ha evolucionado o subido el precio de un producto concreto.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del ingrediente o producto' },
        },
        required: ['nombre'],
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
  // ── ANALIZAR NECESIDADES PEDIDO ────────────────────────────
  {
    type: 'function',
    function: {
      name: 'analizar_necesidades_pedido',
      description: 'Analiza qué ingredientes hace falta reponer (basándose en cuánto tiempo hace que no se piden y el patrón histórico) y los agrupa por proveedor. USAR SIEMPRE cuando el usuario diga "quiero hacer un pedido", "qué tengo que pedir", "haz un pedido", etc. — sin preguntar a qué proveedor. Devuelve la lista de proveedores y los items específicos que necesitan reposición.',
      parameters: { type: 'object', properties: {} },
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

function checkFoodCostImpact(userId: string, ingredienteName: string): string {
  const afectadas = db.prepare(`
    SELECT r.nombre, r.precio_venta,
           ROUND(SUM(
             CASE WHEN l.ingrediente_id IS NOT NULL AND i.cost IS NOT NULL THEN l.cantidad * i.cost
                  WHEN l.coste_unitario IS NOT NULL THEN l.cantidad * l.coste_unitario
                  ELSE 0 END
           ), 4) AS coste_total
    FROM escandallo_receta r
    JOIN escandallo_lineas l ON l.receta_id = r.id AND l.user_id = r.user_id
    LEFT JOIN ingredientes i ON i.id = l.ingrediente_id
    WHERE r.user_id = ? AND r.activo = 1 AND r.precio_venta > 0
      AND r.id IN (
        SELECT DISTINCT l2.receta_id FROM escandallo_lineas l2
        JOIN ingredientes i2 ON i2.id = l2.ingrediente_id
        WHERE l2.user_id = ? AND i2.descr LIKE ?
      )
    GROUP BY r.id
    HAVING coste_total > 0
    ORDER BY CAST(coste_total AS REAL) / r.precio_venta DESC
  `).all(userId, userId, '%' + ingredienteName + '%') as any[]

  if (!afectadas.length) return ''

  const criticas = afectadas.filter(r => (r.coste_total / r.precio_venta) > 0.35)
  const warnings = afectadas.filter(r => {
    const pct = r.coste_total / r.precio_venta
    return pct > 0.30 && pct <= 0.35
  })

  if (!criticas.length && !warnings.length) return ''

  const lines: string[] = ['\n\nIMPACTO EN FOOD COST:']
  for (const r of [...criticas, ...warnings]) {
    const pct = Math.round((r.coste_total / r.precio_venta) * 100)
    const nivel = pct > 35 ? 'CRITICO' : 'REVISAR'
    lines.push(`• ${r.nombre}: ${pct}% food cost [${nivel}]`)
  }
  return lines.join('\n')
}

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
    const rows = db.prepare(q + ' ORDER BY descr ASC LIMIT 30').all(...p) as any[]
    if (!rows.length) return 'No se encontraron ingredientes.'
    return `__INGREDIENTES_CARDS__${JSON.stringify({ ingredientes: rows, filtro: args.nombre || args.tipo || (args.sin_coste ? 'sin coste' : '') })}`
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
    const text = rows.map((r: any, i: number) => `${i + 1}. ${r.descr} — ${r.cost}€/${r.unit || 'ud'}`).join('\n')
    const chart = {
      tipo: 'bar',
      titulo: args.orden === 'mas_caro' ? 'Ingredientes más caros' : 'Ingredientes más baratos',
      datos: rows.slice(0, 8).map((r: any) => ({ label: r.descr, value: r.cost })),
      unidad: '€',
    }
    return `__CHART__${JSON.stringify({ chart, text })}`
  }

  // ── BUSCAR PROVEEDOR ───────────────────────────────────
  if (name === 'buscar_proveedor') {
    let q = 'SELECT id, codi, descr, descr_type, mail, phone FROM proveedores WHERE user_id=?'
    const p: any[] = [userId]
    if (args.nombre) { q += ' AND descr LIKE ?'; p.push('%' + args.nombre + '%') }
    if (args.tipo) { q += ' AND descr_type LIKE ?'; p.push('%' + args.tipo + '%') }
    const rows = db.prepare(q + ' ORDER BY descr ASC LIMIT 20').all(...p) as any[]
    if (!rows.length) return 'No se encontraron proveedores.'
    return `__PROVEEDORES_CARDS__${JSON.stringify({ proveedores: rows })}`
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
    const text = rows.map((r: any, i: number) => `${i + 1}. ${r.vendor} — ${r.total || 0}€ (${r.pedidos} pedidos)`).join('\n')
    const periodoLabel = args.periodo ? args.periodo.replace(/_/g, ' ') : 'histórico'
    const chart = {
      tipo: 'bar',
      titulo: `Gasto por proveedor · ${periodoLabel}`,
      datos: rows.slice(0, 8).map((r: any) => ({ label: r.vendor, value: r.total || 0 })),
      unidad: '€',
    }
    return `__CHART__${JSON.stringify({ chart, text })}`
  }

  // ── INFORME DIARIO ─────────────────────────────────────
  if (name === 'informe_diario') {
    const hoy = new Date().toISOString().split('T')[0]
    const h = new Date().getHours()
    const saludo = h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'

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

    const allPrecios = db.prepare('SELECT nombre, precio, fecha FROM precio_historial WHERE user_id=? ORDER BY nombre, fecha ASC').all(userId) as any[]
    const precioMap: Record<string, { first: number; last: number }> = {}
    for (const p of allPrecios) {
      if (!precioMap[p.nombre]) precioMap[p.nombre] = { first: p.precio, last: p.precio }
      precioMap[p.nombre].last = p.precio
    }
    const alertasPrecios = Object.entries(precioMap)
      .map(([nombre, v]) => ({ nombre, precio_actual: v.last, precio_anterior: v.first, variacion_pct: v.first > 0 ? Math.round(((v.last - v.first) / v.first) * 100) : 0 }))
      .filter(a => a.variacion_pct > 7).sort((a, b) => b.variacion_pct - a.variacion_pct).slice(0, 4)

    const cards: any[] = []
    cards.push({
      id: 'gastos', titulo: 'Gasto compras', icon: 'chart',
      urgencia: variacion !== null && variacion > 15 ? 'warning' : 'normal',
      items: [
        `Este mes: **${gastoMes || 0} EUR**${variacion !== null ? ` (${variacion > 0 ? '+' : ''}${variacion}% vs mes anterior)` : ''}`,
        ...(topProv.length > 0 ? topProv.map((p: any) => `${p.vendor}: ${p.t} EUR`) : ['Sin datos este mes']),
      ],
      acciones: [
        { label: 'Ver analytics', href: '/dashboard/analytics' },
        { label: 'Desglose por proveedor', chat: 'Dame el gasto por proveedor este mes' },
      ],
    })
    if (pedPendEnvio > 0 || pedPendRec > 0) {
      cards.push({
        id: 'pedidos', titulo: 'Pedidos', icon: 'truck',
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
    cards.push({
      id: 'facturas', titulo: 'Facturas pendientes', icon: 'invoice',
      urgencia: facVencidas.c > 0 ? 'danger' : facVencen7.c > 0 ? 'warning' : 'normal',
      items: [
        facVencidas.c > 0 ? `**${facVencidas.c} vencidas** · ${facVencidas.t || 0} EUR` : null,
        facVencen7.c > 0 ? `${facVencen7.c} vencen en 7 días · ${facVencen7.t || 0} EUR` : null,
        `Total pendiente: **${facPendTotal.c} facturas** (${facPendTotal.t || 0} EUR)`,
      ].filter(Boolean),
      acciones: [
        { label: 'Ver facturas', href: '/dashboard/compras/facturas' },
        { label: 'Pagar facturas', chat: 'Muéstrame las facturas pendientes para pagarlas' },
      ],
    })
    if (mermaMes.n > 0) {
      cards.push({
        id: 'merma', titulo: 'Merma este mes', icon: 'merma',
        urgencia: mermaMes.t > 100 ? 'warning' : 'normal',
        items: [
          `**${mermaMes.t || 0} EUR** en ${mermaMes.n} eventos`,
          ...topMerma.map((m: any) => `${m.nombre}: ${m.t} EUR`),
        ],
        acciones: [
          { label: 'Ver sangrado', href: '/dashboard/sangrado' },
          { label: 'Registrar merma', chat: 'Quiero registrar una merma' },
        ],
      })
    }
    if (alertasPrecios.length > 0) {
      cards.push({
        id: 'precios', titulo: 'Alertas de precio', icon: 'alert', urgencia: 'warning',
        items: alertasPrecios.map(a => `**${a.nombre}**: +${a.variacion_pct}% → ${a.precio_actual} EUR`),
        acciones: [
          { label: 'Ver analytics', href: '/dashboard/analytics' },
          { label: 'Actualizar precios', chat: 'Ayúdame a actualizar los precios que han subido' },
        ],
      })
    }
    if (ingSinCoste > 0) {
      cards.push({
        id: 'sin_coste', titulo: 'Ingredientes sin coste', icon: 'warning', urgencia: 'warning',
        items: [`**${ingSinCoste} ingredientes** sin precio registrado (afecta al escandallo)`],
        acciones: [
          { label: 'Ver ingredientes', href: '/dashboard/ingredientes' },
          { label: 'Cuáles son', chat: 'Dime qué ingredientes no tienen coste registrado' },
        ],
      })
    }
    return `__BRIEF_CARDS__${JSON.stringify({ saludo, fecha: hoy, cards })}`
  }

  // ── PEDIDOS PENDIENTES DE RECIBIR ────────────────────────
  if (name === 'pedidos_pendientes_recibir') {
    const pedidos = db.prepare(
      `SELECT id, descr, data, year, month FROM lista_pedidos WHERE user_id=? AND pending_receive>0 ORDER BY id DESC LIMIT 20`
    ).all(userId) as any[]
    if (!pedidos.length) return 'No hay pedidos pendientes de confirmar recepción.'
    const enriched = pedidos.map((p: any) => {
      let lineas: any[] = []
      try { lineas = JSON.parse(p.data || '[]') } catch {}
      return {
        id: p.id,
        descr: p.descr || 'Sin nombre',
        mes: p.month && p.year ? `${p.year}-${String(p.month).padStart(2, '0')}` : null,
        lineas: lineas.slice(0, 6),
        total_lineas: lineas.length,
      }
    })
    return `__PEDIDOS_RECIBIR_CARDS__${JSON.stringify({ pedidos: enriched })}`
  }

  // ── ALERTAS SUBIDA DE PRECIO ──────────────────────────────
  if (name === 'alertas_subida_precio') {
    const umbral = (args.umbral_pct || 10) / 100
    const allPrecios = db.prepare(
      'SELECT nombre, precio, vendor, fecha FROM precio_historial WHERE user_id=? ORDER BY nombre, id ASC'
    ).all(userId) as any[]
    const precioMap: Record<string, { first: number; last: number; lastVendor: string | null; lastFecha: string }> = {}
    for (const p of allPrecios) {
      if (!precioMap[p.nombre]) precioMap[p.nombre] = { first: p.precio, last: p.precio, lastVendor: p.vendor, lastFecha: p.fecha }
      precioMap[p.nombre].last = p.precio
      precioMap[p.nombre].lastVendor = p.vendor
      precioMap[p.nombre].lastFecha = p.fecha
    }
    const subidas = Object.entries(precioMap)
      .filter(([, v]) => v.first > 0 && ((v.last - v.first) / v.first) >= umbral)
      .map(([nombre, v]) => ({
        nombre,
        precio_anterior: v.first,
        precio_actual: v.last,
        diff_pct: Math.round(((v.last - v.first) / v.first) * 100),
        vendor: v.lastVendor,
        fecha: v.lastFecha,
      }))
      .sort((a, b) => b.diff_pct - a.diff_pct)
    if (!subidas.length) return `No hay ingredientes con subidas de precio superiores al ${Math.round(umbral * 100)}%.`
    return `__PRECIOS_ALERTA_CARDS__${JSON.stringify({ subidas, umbral_pct: Math.round(umbral * 100) })}`
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
    const text = `Merma ${args.periodo || 'este mes'} — Total: ${total || 0}€\n` +
      rows.map((r: any) => `• ${r.nombre} | ${r.cantidad || '?'} ${r.unidad || ''} | ${r.motivo} | ${r.coste_estimado ? r.coste_estimado + '€' : '-'} | ${r.fecha}`).join('\n')
    // Chart: top products by cost
    const byProduct: Record<string, number> = {}
    for (const r of rows as any[]) {
      byProduct[r.nombre] = (byProduct[r.nombre] || 0) + (r.coste_estimado || 0)
    }
    const chartDatos = Object.entries(byProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
    if (chartDatos.length > 1) {
      const chart = {
        tipo: 'bar',
        titulo: `Merma por producto · ${args.periodo || 'este mes'}`,
        datos: chartDatos,
        unidad: '€',
      }
      return `__CHART__${JSON.stringify({ chart, text })}`
    }
    return text
  }

  // ── GUARDAR ALBARÁN COMPLETO ──────────────────────────────
  if (name === 'guardar_albaran_completo') {
    try {
      const { vendor, delivery_num, date_delivery, base, taxes, total, nif, lineas = [] } = args
      const fecha = date_delivery ?? new Date().toISOString().split('T')[0]

      const albaran = db.prepare(
        `INSERT INTO albaranes_compra (user_id, vendor, delivery_num, date_delivery, base, taxes, total, nif) VALUES (?,?,?,?,?,?,?,?)`
      ).run(userId, vendor ?? null, delivery_num ?? null, fecha, base ?? null, taxes ?? null, total ?? null, nif ?? null)

      const priceChanges: { nombre: string; precio_anterior: number | null; precio_nuevo: number; diff_pct: number | null; recetas_afectadas: string[] }[] = []

      const tx = db.transaction(() => {
        for (const l of lineas as any[]) {
          const { nombre, cantidad, unidad, precio_unitario, total_linea } = l
          if (!nombre) continue
          db.prepare(`INSERT INTO lineas_albaran_compra (user_id, vendor, nombre, cantidad, unidad, precio_unitario, total_linea, fecha) VALUES (?,?,?,?,?,?,?,?)`)
            .run(userId, vendor ?? null, nombre, cantidad ?? null, unidad ?? null, precio_unitario ?? null, total_linea ?? null, fecha)
          if (precio_unitario != null) {
            const prev = db.prepare(`SELECT precio FROM precio_historial WHERE user_id=? AND nombre LIKE ? ORDER BY id DESC LIMIT 1`).get(userId, '%' + nombre + '%') as any
            db.prepare(`INSERT INTO precio_historial (user_id, nombre, vendor, precio, unidad, fuente) VALUES (?,?,?,?,?,?)`).run(userId, nombre, vendor ?? null, precio_unitario, unidad ?? null, 'albaran')
            const ing = db.prepare(`SELECT id FROM ingredientes WHERE user_id=? AND descr LIKE ? LIMIT 1`).get(userId, '%' + nombre + '%') as any
            if (ing) db.prepare(`UPDATE ingredientes SET cost=? WHERE id=? AND user_id=?`).run(precio_unitario, ing.id, userId)
            const prevPrice = prev?.precio ?? null
            const diffPct = prevPrice && prevPrice > 0 ? Math.round(((precio_unitario - prevPrice) / prevPrice) * 100) : null
            // Find affected recipes
            const recetas = ing ? db.prepare(`SELECT r.nombre FROM escandallo_receta r JOIN escandallo_lineas l ON l.receta_id=r.id WHERE l.ingrediente_id=? AND r.user_id=? AND r.activo=1`).all(ing.id, userId) as any[] : []
            priceChanges.push({ nombre, precio_anterior: prevPrice, precio_nuevo: precio_unitario, diff_pct: diffPct, recetas_afectadas: recetas.map(r => r.nombre) })
          }
        }
      })
      tx()

      const foodCostImpact = checkFoodCostImpact(userId, (lineas as any[]).map((l: any) => l.nombre).join(','))

      return `__ALBARAN_GUARDADO__${JSON.stringify({
        albaran_id: albaran.lastInsertRowid,
        vendor, delivery_num, date_delivery: fecha, base, taxes, total,
        lineas: args.lineas || [],
        price_changes: priceChanges,
        food_cost_impact: foodCostImpact.trim(),
      })}`
    } catch (e: any) { return `Error: ${e.message}` }
  }

  // ── INFORME SEMANAL ───────────────────────────────────────
  if (name === 'informe_semanal') {
    const gastoSemana = (db.prepare(`SELECT ROUND(SUM(total),2) as t, COUNT(*) as c FROM pedidos_compra WHERE user_id=? AND date(date_order)>=date('now','-7 days')`).get(userId) as any)
    const gastoSemAnt = (db.prepare(`SELECT ROUND(SUM(total),2) as t FROM pedidos_compra WHERE user_id=? AND date(date_order) BETWEEN date('now','-14 days') AND date('now','-8 days')`).get(userId) as any)
    const variacion = gastoSemAnt.t > 0 ? Math.round(((gastoSemana.t - gastoSemAnt.t) / gastoSemAnt.t) * 100) : null

    const topProv = db.prepare(`SELECT vendor, ROUND(SUM(total),2) as t FROM pedidos_compra WHERE user_id=? AND date(date_order)>=date('now','-7 days') GROUP BY vendor ORDER BY t DESC LIMIT 3`).all(userId) as any[]

    const merma = (db.prepare(`SELECT ROUND(SUM(coste_estimado),2) as t, COUNT(*) as n FROM merma_registro WHERE user_id=? AND date(fecha)>=date('now','-7 days')`).get(userId) as any)
    const topMerma = db.prepare(`SELECT nombre, ROUND(SUM(coste_estimado),2) as t FROM merma_registro WHERE user_id=? AND date(fecha)>=date('now','-7 days') GROUP BY nombre ORDER BY t DESC LIMIT 3`).all(userId) as any[]

    const facVenc = (db.prepare(`SELECT COUNT(*) as c, ROUND(SUM(total),2) as t FROM facturas_compra WHERE user_id=? AND (paid=0 OR paid IS NULL) AND date_due<date('now')`).get(userId) as any)
    const facPend = (db.prepare(`SELECT COUNT(*) as c, ROUND(SUM(total),2) as t FROM facturas_compra WHERE user_id=? AND (paid=0 OR paid IS NULL)`).get(userId) as any)

    const preciosSemana = db.prepare(`SELECT nombre, precio, vendor FROM precio_historial WHERE user_id=? AND date(fecha)>=date('now','-7 days') ORDER BY nombre, id ASC`).all(userId) as any[]
    const precMap: Record<string, { first: number; last: number; vendor: string }> = {}
    for (const p of preciosSemana) {
      if (!precMap[p.nombre]) precMap[p.nombre] = { first: p.precio, last: p.precio, vendor: p.vendor }
      precMap[p.nombre].last = p.precio
    }
    const subidas = Object.entries(precMap).filter(([, v]) => v.first > 0 && ((v.last - v.first) / v.first) > 0.05).sort((a, b) => ((b[1].last - b[1].first) / b[1].first) - ((a[1].last - a[1].first) / a[1].first)).slice(0, 4)

    const recetasCrit = db.prepare(`SELECT r.nombre, r.precio_venta, ROUND(SUM(CASE WHEN l.ingrediente_id IS NOT NULL AND i.cost IS NOT NULL THEN l.cantidad*i.cost WHEN l.coste_unitario IS NOT NULL THEN l.cantidad*l.coste_unitario ELSE 0 END),4) AS coste FROM escandallo_receta r JOIN escandallo_lineas l ON l.receta_id=r.id AND l.user_id=r.user_id LEFT JOIN ingredientes i ON i.id=l.ingrediente_id WHERE r.user_id=? AND r.activo=1 AND r.precio_venta>0 GROUP BY r.id HAVING CAST(coste AS REAL)/r.precio_venta>0.35 ORDER BY CAST(coste AS REAL)/r.precio_venta DESC LIMIT 4`).all(userId) as any[]

    const semana = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    return `__INFORME_SEMANAL__${JSON.stringify({
      fecha: semana,
      gasto: { total: gastoSemana.t || 0, pedidos: gastoSemana.c || 0, variacion, top: topProv },
      merma: { total: merma.t || 0, eventos: merma.n || 0, top: topMerma },
      facturas: { vencidas_c: facVenc.c, vencidas_t: facVenc.t || 0, pendientes_c: facPend.c, pendientes_t: facPend.t || 0 },
      precios_subida: subidas.map(([n, v]) => ({ nombre: n, diff_pct: Math.round(((v.last - v.first) / v.first) * 100), precio: v.last, vendor: v.vendor })),
      food_cost_critico: recetasCrit.map(r => ({ nombre: r.nombre, pct: Math.round((r.coste / r.precio_venta) * 100) })),
    })}`
  }

  // ── FACTURAS PAGAR ────────────────────────────────────────
  if (name === 'listar_facturas_para_pagar') {
    const facturas = db.prepare(`
      SELECT id, invoice_num, vendor, total, date_due, date_invoice, base, taxes, comment
      FROM facturas_compra
      WHERE user_id = ? AND (paid = 0 OR paid IS NULL)
      ORDER BY date_due ASC NULLS LAST
      LIMIT 40
    `).all(userId) as any[]
    if (!facturas.length) return '__FACTURAS_PAGAR__' + JSON.stringify({ facturas: [] })
    const today = new Date().toISOString().split('T')[0]
    const enriched = facturas.map((f: any) => ({
      ...f,
      vencida: f.date_due && f.date_due < today,
      dias_vencida: f.date_due ? Math.floor((Date.now() - new Date(f.date_due).getTime()) / 86400000) : null,
    }))
    return '__FACTURAS_PAGAR__' + JSON.stringify({ facturas: enriched })
  }

  if (name === 'marcar_factura_pagada') {
    let q = 'UPDATE facturas_compra SET paid=1 WHERE user_id=? AND (paid=0 OR paid IS NULL)'
    const params: any[] = [userId]
    if (args.todas) { /* no extra filter */ }
    else if (args.vendor && args.invoice_num) { q += ' AND vendor LIKE ? AND invoice_num=?'; params.push('%' + args.vendor + '%', args.invoice_num) }
    else if (args.vendor) { q += ' AND vendor LIKE ?'; params.push('%' + args.vendor + '%') }
    else if (args.invoice_num) { q += ' AND invoice_num=?'; params.push(args.invoice_num) }
    else return 'Necesito al menos el proveedor o el número de factura.'
    const r = db.prepare(q).run(...params)
    return r.changes > 0
      ? `${r.changes} factura${r.changes > 1 ? 's' : ''} marcada${r.changes > 1 ? 's' : ''} como pagada${r.changes > 1 ? 's' : ''}.`
      : 'No encontré facturas pendientes con esos criterios.'
  }

  // ── COMPARAR PRECIOS PROVEEDOR ────────────────────────────
  if (name === 'comparar_precios_proveedor') {
    // Latest price per ingredient + vendor
    const rows = db.prepare(`
      SELECT ph.nombre, ph.vendor, ph.precio, ph.unidad, ph.fecha
      FROM precio_historial ph
      WHERE ph.user_id = ?
        AND ph.vendor IS NOT NULL
        AND ph.id = (
          SELECT MAX(ph2.id) FROM precio_historial ph2
          WHERE ph2.user_id = ph.user_id AND ph2.nombre = ph.nombre AND ph2.vendor = ph.vendor
        )
      ${args.nombre ? 'AND ph.nombre LIKE ?' : ''}
      ORDER BY ph.nombre, ph.precio ASC
    `).all(...(args.nombre ? [userId, '%' + args.nombre + '%'] : [userId])) as any[]

    if (!rows.length) return args.nombre
      ? `No hay historial de precios para "${args.nombre}" con proveedor registrado.`
      : 'No hay historial de precios con proveedor registrado aún.'

    // Group by ingredient
    const byIng: Record<string, { vendor: string; precio: number; unidad: string | null; fecha: string }[]> = {}
    for (const r of rows) {
      if (!byIng[r.nombre]) byIng[r.nombre] = []
      byIng[r.nombre].push({ vendor: r.vendor, precio: r.precio, unidad: r.unidad, fecha: r.fecha })
    }

    // Only keep ingredients with 2+ vendors
    const comparables = Object.entries(byIng)
      .filter(([, vs]) => vs.length >= 2)
      .map(([nombre, vs]) => {
        const sorted = [...vs].sort((a, b) => a.precio - b.precio)
        const min = sorted[0]
        const max = sorted[sorted.length - 1]
        const diffPct = Math.round(((max.precio - min.precio) / min.precio) * 100)
        return { nombre, vendors: sorted, min, max, diffPct }
      })
      .sort((a, b) => b.diffPct - a.diffPct)

    if (!comparables.length) {
      if (args.nombre) return `Solo hay un proveedor con precio registrado para "${args.nombre}". Necesitas comprar a dos o más para comparar.`
      return 'No hay ingredientes comprados a dos o más proveedores distintos aún.'
    }

    // Single ingredient → return bar chart
    if (args.nombre && comparables.length === 1) {
      const ing = comparables[0]
      const text = `Comparativa de precio para ${ing.nombre}:\n` +
        ing.vendors.map((v, i) => `${i + 1}. ${v.vendor}: ${v.precio}€/${v.unidad || 'ud'} (${v.fecha})`).join('\n') +
        `\n\nMás barato: ${ing.min.vendor} (${ing.min.precio}€)\nMás caro: ${ing.max.vendor} (${ing.max.precio}€)\nDiferencia: ${ing.diffPct}%`
      const chart = {
        tipo: 'bar',
        titulo: `Precio de ${ing.nombre} por proveedor`,
        datos: ing.vendors.map(v => ({ label: v.vendor, value: v.precio })),
        unidad: `€/${ing.vendors[0].unidad || 'ud'}`,
      }
      return `__CHART__${JSON.stringify({ chart, text })}`
    }

    // Multiple ingredients → text table of top opportunities
    const top = args.top || 8
    const lista = comparables.slice(0, top)
    const text = `Top oportunidades de ahorro por proveedor:\n\n` +
      lista.map(ing => {
        const vendors = ing.vendors.map(v => `${v.vendor} ${v.precio}€`).join(' · ')
        return `• ${ing.nombre}: ${vendors} → ${ing.min.vendor} es ${ing.diffPct}% más barato`
      }).join('\n')
    return text
  }

  // ── ANALIZAR FOOD COST RECETAS ────────────────────────────
  if (name === 'analizar_food_cost_recetas') {
    const umbral = (args.umbral_pct || 33) / 100
    const recetas = db.prepare(`
      SELECT r.id, r.nombre, r.precio_venta, r.raciones,
             ROUND(SUM(
               CASE WHEN l.ingrediente_id IS NOT NULL AND i.cost IS NOT NULL THEN l.cantidad * i.cost
                    WHEN l.coste_unitario IS NOT NULL THEN l.cantidad * l.coste_unitario
                    ELSE 0 END
             ), 4) AS coste_total
      FROM escandallo_receta r
      JOIN escandallo_lineas l ON l.receta_id = r.id AND l.user_id = r.user_id
      LEFT JOIN ingredientes i ON i.id = l.ingrediente_id
      WHERE r.user_id = ? AND r.activo = 1 AND r.precio_venta > 0
      GROUP BY r.id
      ORDER BY CAST(coste_total AS REAL) / r.precio_venta DESC
    `).all(userId) as any[]

    if (!recetas.length) return 'No hay recetas con precio de venta definido.'

    const enriched = recetas.map((r: any) => {
      const pct = Math.round((r.coste_total / r.precio_venta) * 100)
      const pvSugerido = r.coste_total > 0 ? Math.ceil((r.coste_total / 0.30) * 100) / 100 : null
      const nivel: 'critico' | 'revisar' | 'aceptable' | 'excelente' =
        pct > 40 ? 'critico' : pct > 33 ? 'revisar' : pct > 28 ? 'aceptable' : 'excelente'
      return { id: r.id, nombre: r.nombre, coste: r.coste_total, pvp: r.precio_venta, pct, pvSugerido, nivel }
    })

    return `__FOOD_COST_CARDS__${JSON.stringify({ recetas: enriched, umbral_pct: Math.round(umbral * 100) })}`
  }

  // ── CALCULAR COMPRA SEMANAL ───────────────────────────────
  if (name === 'calcular_compra_semanal') {
    const platos = (args.platos || []) as { nombre: string; raciones: number }[]
    const resultado: any[] = []

    for (const plato of platos) {
      const receta = db.prepare(
        `SELECT id, nombre, raciones, merma_pct FROM escandallo_receta WHERE user_id=? AND nombre LIKE ? AND activo=1 LIMIT 1`
      ).get(userId, '%' + plato.nombre + '%') as any

      if (!receta) { resultado.push({ nombre: plato.nombre, raciones: plato.raciones, encontrada: false, lineas: [] }); continue }

      const lineas = db.prepare(`
        SELECT l.nombre_libre, l.cantidad, l.unidad, l.coste_unitario,
               i.descr AS ing_nombre, i.cost AS ing_coste, i.unit AS ing_unidad,
               p.descr AS proveedor_nombre, p.mail AS proveedor_email, p.phone AS proveedor_phone
        FROM escandallo_lineas l
        LEFT JOIN ingredientes i ON l.ingrediente_id = i.id
        LEFT JOIN proveedores p ON p.id = i.proveedor_id
        WHERE l.receta_id=? AND l.user_id=?
      `).all(receta.id, userId) as any[]

      const mermaFactor = 1 + ((receta.merma_pct || 0) / 100)
      const ratio = plato.raciones / (receta.raciones || 1)

      resultado.push({
        nombre: receta.nombre,
        raciones: plato.raciones,
        encontrada: true,
        lineas: lineas.map((l: any) => ({
          nombre: l.ing_nombre || l.nombre_libre || 'Ingrediente',
          cantidad: Math.round(l.cantidad * ratio * mermaFactor * 1000) / 1000,
          unidad: l.unidad || l.ing_unidad || null,
          coste_unitario: l.ing_coste ?? l.coste_unitario ?? null,
          proveedor: l.proveedor_nombre || null,
          proveedor_email: l.proveedor_email || null,
          proveedor_phone: l.proveedor_phone || null,
          receta: receta.nombre,
        })),
      })
    }

    const platosEncontrados = resultado.filter(p => p.encontrada)
    if (!platosEncontrados.length) {
      const nombres = platos.map(p => p.nombre).join(', ')
      return `No encontré ninguna de las recetas: ${nombres}. Comprueba que están en el escandallo.`
    }

    // Agrupar por proveedor, sumando cantidades del mismo ingrediente
    const grupos: Record<string, { proveedor: any; itemsMap: Record<string, any> }> = {}
    const sinProveedorMap: Record<string, any> = {}

    for (const plato of platosEncontrados) {
      for (const linea of plato.lineas) {
        const key = linea.nombre.toLowerCase()
        if (!linea.proveedor) {
          if (!sinProveedorMap[key]) sinProveedorMap[key] = { ...linea, recetas: [] }
          sinProveedorMap[key].cantidad = Math.round((sinProveedorMap[key].cantidad + linea.cantidad) * 1000) / 1000
          if (!sinProveedorMap[key].recetas.includes(linea.receta)) sinProveedorMap[key].recetas.push(linea.receta)
        } else {
          if (!grupos[linea.proveedor]) grupos[linea.proveedor] = { proveedor: { nombre: linea.proveedor, email: linea.proveedor_email, phone: linea.proveedor_phone }, itemsMap: {} }
          if (!grupos[linea.proveedor].itemsMap[key]) grupos[linea.proveedor].itemsMap[key] = { ...linea, recetas: [] }
          grupos[linea.proveedor].itemsMap[key].cantidad = Math.round((grupos[linea.proveedor].itemsMap[key].cantidad + linea.cantidad) * 1000) / 1000
          if (!grupos[linea.proveedor].itemsMap[key].recetas.includes(linea.receta)) grupos[linea.proveedor].itemsMap[key].recetas.push(linea.receta)
        }
      }
    }

    const gruposArr = Object.values(grupos).map(g => {
      const items = Object.values(g.itemsMap).map((item: any) => ({
        ...item,
        subtotal: item.coste_unitario ? Math.round(item.cantidad * item.coste_unitario * 100) / 100 : null,
      }))
      const coste_total = items.reduce((s: number, i: any) => s + (i.subtotal ?? 0), 0)
      return { proveedor: g.proveedor, items, coste_total: Math.round(coste_total * 100) / 100 }
    })

    const sinProveedor = Object.values(sinProveedorMap)
    const coste_total_estimado = gruposArr.reduce((s, g) => s + g.coste_total, 0)

    return `__COMPRA_SEMANAL__${JSON.stringify({
      platos: resultado,
      grupos: gruposArr,
      sinProveedor,
      coste_total_estimado: Math.round(coste_total_estimado * 100) / 100,
    })}`
  }

  // ── HISTORIAL PRECIO INGREDIENTE ─────────────────────────
  if (name === 'historial_precio_ingrediente') {
    const rows = db.prepare(
      `SELECT precio, fecha, vendor FROM precio_historial WHERE user_id=? AND nombre LIKE ? ORDER BY fecha ASC LIMIT 30`
    ).all(userId, '%' + args.nombre + '%') as any[]
    if (rows.length < 2) return `No hay suficiente historial de precios para "${args.nombre}".`
    const first = rows[0]
    const last = rows[rows.length - 1]
    const cambio = first.precio > 0 ? Math.round(((last.precio - first.precio) / first.precio) * 100) : 0
    const text = `Historial de precio: ${args.nombre}\nPrimero: ${first.precio}€ (${first.fecha}) → Último: ${last.precio}€ (${last.fecha})\nVariación: ${cambio > 0 ? '+' : ''}${cambio}%`
    const chart = {
      tipo: 'line',
      titulo: `Evolución precio · ${args.nombre}`,
      datos: rows.map((r: any) => ({ label: r.fecha, value: r.precio })),
      unidad: '€',
    }
    return `__CHART__${JSON.stringify({ chart, text })}`
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
      const impacto = checkFoodCostImpact(userId, nombre)
      return `Precio registrado: ${nombre} → ${precio}€${unidad ? '/' + unidad : ''}${vendor ? ' (' + vendor + ')' : ''}${impacto}`
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
      const impacto = precio_unitario ? checkFoodCostImpact(userId, nombre) : ''
      return `Línea guardada: ${nombre} × ${cantidad || '?'} ${unidad || ''} a ${precio_unitario || '?'}€${impacto}`
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

  // ── ANALIZAR NECESIDADES PEDIDO ────────────────────────────
  if (name === 'analizar_necesidades_pedido') {
    // For each ingredient with vendor, find last delivery date and average qty
    const items = db.prepare(`
      SELECT
        i.descr        AS nombre,
        i.unit         AS unidad,
        i.type         AS tipo,
        p.descr        AS proveedor,
        p.mail         AS proveedor_email,
        p.phone        AS proveedor_phone,
        (SELECT MAX(l.fecha) FROM lineas_albaran_compra l
           WHERE l.user_id=i.user_id AND l.nombre = i.descr)        AS ultima_fecha,
        (SELECT ROUND(AVG(l.cantidad), 2) FROM lineas_albaran_compra l
           WHERE l.user_id=i.user_id AND l.nombre = i.descr)        AS cant_media
      FROM ingredientes i
      JOIN proveedores p ON p.id = i.proveedor_id
      WHERE i.user_id=?
      ORDER BY p.descr, i.descr
    `).all(userId) as any[]

    const today = new Date()
    // Reorder thresholds (days since last delivery)
    const freshTypes = new Set(['Pescado','Marisco','Carne','Verdura','Hongo','Lácteo','Fruta','Hierba','Charcutería','Panadería'])
    const dryThreshold = 30
    const freshThreshold = 7

    const needsReorder: Record<string, { proveedor: any; items: any[] }> = {}

    for (const it of items) {
      const isFresh = freshTypes.has(it.tipo)
      const threshold = isFresh ? freshThreshold : dryThreshold
      let daysSince = 999
      if (it.ultima_fecha) {
        const last = new Date(it.ultima_fecha)
        daysSince = Math.floor((today.getTime() - last.getTime()) / 86400000)
      }
      if (daysSince < threshold) continue // No hace falta reponer aún

      // Suggested qty = historical avg or 1 unit fallback
      const cant = it.cant_media || 1

      if (!needsReorder[it.proveedor]) {
        needsReorder[it.proveedor] = {
          proveedor: { nombre: it.proveedor, email: it.proveedor_email, phone: it.proveedor_phone },
          items: [],
        }
      }
      needsReorder[it.proveedor].items.push({
        nombre: it.nombre,
        cantidad: cant,
        unidad: it.unidad,
        dias_sin_pedir: daysSince === 999 ? 'nunca' : daysSince,
      })
    }

    const grupos = Object.values(needsReorder)
    if (!grupos.length) {
      return 'Todos los ingredientes están dentro de su ciclo de pedido habitual. No hace falta reponer nada urgente.'
    }

    return `__NECESIDADES_PEDIDO__${JSON.stringify({ grupos })}`
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
- FOTO albarán → usa guardar_albaran_completo con TODAS las líneas en una sola llamada (vendor, delivery_num, fecha, líneas con nombre/cantidad/unidad/precio_unitario/total_linea). NUNCA uses guardar_albaran_compra + guardar_linea_albaran por separado al escanear.
- FOTO factura → extrae todo en tabla markdown, pregunta si guardar. Si confirma → guardar_factura_compra.
- "informe semanal/resumen de la semana/qué tal la semana/balance semanal" (especialmente los lunes) → informe_semanal
- "resumen/informe/cómo estamos/brief/qué pasa/estado general/panel" → informe_diario (genera tarjetas visuales)
- "gasto/cuánto gastamos" → resumen_gastos o gasto_por_proveedor (genera gráfico automáticamente)
- "ingredientes más caros/baratos" → top_ingredientes_coste (genera gráfico)
- "food cost/rentabilidad/qué platos revisar/margen de platos/cuál tiene el food cost más alto" → analizar_food_cost_recetas (genera tarjetas visuales por receta)
- "quién cobra más barato/comparativa precios/ahorro proveedor/precio X entre proveedores" → comparar_precios_proveedor
- "facturas pendientes/qué debo pagar/pagar facturas/qué tengo que pagar/facturas vencidas" → listar_facturas_para_pagar (genera tarjeta interactiva con botón de pago)
- "he pagado/marca como pagada/ya pagué a X" → marcar_factura_pagada
- "pedidos pendientes de recibir/qué tengo por recibir/entregas pendientes" → pedidos_pendientes_recibir (genera tarjetas de pedido)
- "ingredientes han subido de precio/alertas de precio/qué ha subido/subidas de coste" → alertas_subida_precio (genera tarjetas visuales)
- "merma/pérdidas" → ver_merma (genera gráfico si hay datos suficientes)
- "evolución/precio/ha subido X" → historial_precio_ingrediente (genera gráfico de línea)
- "busca/qué ingredientes/cuáles/ingredientes sin coste" → buscar_ingrediente (genera tarjetas visuales)
- "esta semana hago/voy a hacer/planificar producción/cuánto tengo que pedir para X raciones" → calcular_compra_semanal con los platos y raciones mencionados
- PEDIDOS — flujo obligatorio cuando el usuario diga "quiero pedir/hacer un pedido/qué tengo que pedir/repón":
  1. JAMÁS preguntes "qué proveedor". Llama YA a analizar_necesidades_pedido — genera una tarjeta interactiva con botones por proveedor.
  2. El usuario verá los artículos por proveedor y podrá elegir Email, WhatsApp, Más tarde o Eliminar directamente en la tarjeta. NO hace falta preguntar por el canal.
- Si el usuario YA especifica un proveedor concreto: salta a sugerir_items_pedido({proveedor_nombre}) y luego al proponer_pedido_*.
- selector_pedido SOLO si el usuario pide explícitamente "muéstrame los proveedores" o "quiero elegir manualmente".
- PROHIBIDO usar nombres genéricos ("carne", "pescado", "verduras", "fruta") en items de pedido. SIEMPRE nombres específicos del catálogo: "Salmón fresco (lomo)", "Solomillo de ternera", "Tomate rama madurado", etc.
- WhatsApp INTEGRADO — SÍ PUEDES. Jamás digas que no puedes.`

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
  let necesidadesPedido: any = null
  let compraSemanal: any = null
  let facturasPagar: any = null
  let chartData: any = null
  let albaranGuardado: any = null
  let informeSemanal: any = null
  let ingredientesCards: any = null
  let proveedoresCards: any = null
  let pedidosRecibirCards: any = null
  let preciosAlertaCards: any = null
  let foodCostCards: any = null

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
    } else if (result.startsWith('__NECESIDADES_PEDIDO__')) {
      necesidadesPedido = JSON.parse(result.slice('__NECESIDADES_PEDIDO__'.length))
      results.push('Análisis de necesidades generado.')
    } else if (result.startsWith('__FACTURAS_PAGAR__')) {
      facturasPagar = JSON.parse(result.slice('__FACTURAS_PAGAR__'.length))
      results.push('Lista de facturas pendientes generada.')
    } else if (result.startsWith('__COMPRA_SEMANAL__')) {
      compraSemanal = JSON.parse(result.slice('__COMPRA_SEMANAL__'.length))
      results.push('Lista de la compra semanal generada.')
    } else if (result.startsWith('__ALBARAN_GUARDADO__')) {
      albaranGuardado = JSON.parse(result.slice('__ALBARAN_GUARDADO__'.length))
      results.push('Albarán guardado.')
    } else if (result.startsWith('__INFORME_SEMANAL__')) {
      informeSemanal = JSON.parse(result.slice('__INFORME_SEMANAL__'.length))
      results.push('Informe semanal generado.')
    } else if (result.startsWith('__INGREDIENTES_CARDS__')) {
      ingredientesCards = JSON.parse(result.slice('__INGREDIENTES_CARDS__'.length))
      results.push('Lista de ingredientes generada.')
    } else if (result.startsWith('__PROVEEDORES_CARDS__')) {
      proveedoresCards = JSON.parse(result.slice('__PROVEEDORES_CARDS__'.length))
      results.push('Lista de proveedores generada.')
    } else if (result.startsWith('__PEDIDOS_RECIBIR_CARDS__')) {
      pedidosRecibirCards = JSON.parse(result.slice('__PEDIDOS_RECIBIR_CARDS__'.length))
      results.push('Pedidos pendientes generados.')
    } else if (result.startsWith('__PRECIOS_ALERTA_CARDS__')) {
      preciosAlertaCards = JSON.parse(result.slice('__PRECIOS_ALERTA_CARDS__'.length))
      results.push('Alertas de precio generadas.')
    } else if (result.startsWith('__FOOD_COST_CARDS__')) {
      foodCostCards = JSON.parse(result.slice('__FOOD_COST_CARDS__'.length))
      results.push('Análisis de food cost generado.')
    } else if (result.startsWith('__CHART__')) {
      const parsed = JSON.parse(result.slice('__CHART__'.length))
      chartData = parsed.chart
      results.push(parsed.text)
    } else {
      results.push(result)
    }
  }

  // Visual cards → return immediately, no follow-up needed
  if (briefCards)          return NextResponse.json({ reply: '', action: toolNames, briefCards })
  if (pedidoSelector)      return NextResponse.json({ reply: '', action: toolNames, pedidoSelector })
  if (necesidadesPedido)   return NextResponse.json({ reply: '', action: toolNames, necesidadesPedido })
  if (compraSemanal)       return NextResponse.json({ reply: '', action: toolNames, compraSemanal })
  if (facturasPagar)       return NextResponse.json({ reply: '', action: toolNames, facturasPagar })
  if (albaranGuardado)     return NextResponse.json({ reply: '', action: toolNames, albaranGuardado })
  if (informeSemanal)      return NextResponse.json({ reply: '', action: toolNames, informeSemanal })
  if (ingredientesCards)   return NextResponse.json({ reply: '', action: toolNames, ingredientesCards })
  if (proveedoresCards)    return NextResponse.json({ reply: '', action: toolNames, proveedoresCards })
  if (pedidosRecibirCards) return NextResponse.json({ reply: '', action: toolNames, pedidosRecibirCards })
  if (preciosAlertaCards)  return NextResponse.json({ reply: '', action: toolNames, preciosAlertaCards })
  if (foodCostCards)       return NextResponse.json({ reply: '', action: toolNames, foodCostCards })
  if (whatsappProposal)    return NextResponse.json({ reply: '', action: toolNames, whatsappProposal })

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
  return NextResponse.json({ reply, action: toolNames, emailProposal, chartData: chartData || undefined })
}
