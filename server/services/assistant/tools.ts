// Herramientas que el asistente puede invocar. Solo el contrato (nombre,
// descripción, parámetros): la ejecución vive en index.ts sobre los servicios.
const fn = (name: string, description: string, properties: Record<string, any> = {}, required: string[] = []) =>
  ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } })

const S = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) })
const N = (description?: string) => ({ type: 'number', ...(description ? { description } : {}) })
const B = (description?: string) => ({ type: 'boolean', ...(description ? { description } : {}) })

const LINEA = { type: 'object', properties: { nombre: S(), cantidad: N(), unidad: S('kg|g|l|ml|ud|docena'), precio_unitario: N(), total_linea: N() }, required: ['nombre'] }
const ITEM = { type: 'object', properties: { nombre: S('Nombre exacto del catálogo'), cantidad: N(), unidad: S() }, required: ['nombre'] }

export const TOOLS: any[] = [
  fn('buscar_ingrediente', 'Busca ingredientes por nombre, categoría o los que no tienen coste', { nombre: S(), sin_coste: B(), tipo: S('categoría') }),
  fn('crear_ingrediente', 'Crea un ingrediente', { descr: S('nombre'), type: S('categoría'), unit: S('kg|g|l|ml|ud|docena'), cost: N('€ por unidad') }, ['descr']),
  fn('actualizar_ingrediente', 'Actualiza coste, unidad o categoría de un ingrediente', { id: N(), nombre: S('para buscar si no hay id'), cost: N(), unit: S(), type: S() }),
  fn('top_ingredientes_coste', 'Los N ingredientes más caros o más baratos', { n: N('default 10'), orden: { type: 'string', enum: ['mas_caro', 'mas_barato'] } }, ['orden']),
  fn('buscar_proveedor', 'Busca proveedores por nombre', { nombre: S() }),
  fn('crear_proveedor', 'Crea un proveedor', { descr: S('nombre'), nif: S(), mail: S(), phone: S() }, ['descr']),
  fn('ver_albaranes_recientes', 'Últimos albaranes de compra', { n: N('default 10'), proveedor: S('filtrar por proveedor') }),
  fn('guardar_albaran_completo', 'Guarda un albarán completo: cabecera + TODAS las líneas en una sola llamada. Usar siempre al escanear o dictar un albarán.',
     { vendor: S('proveedor'), nif: S(), delivery_num: S('número de albarán'), date_delivery: S('YYYY-MM-DD'), base: N('base sin IVA'), taxes: N('IVA en €'), total: N(), lineas: { type: 'array', items: LINEA, description: 'Todos los artículos' } }, ['vendor', 'lineas']),
  fn('guardar_factura_compra', 'Guarda una factura de compra (tras escanear o dictar)', { vendor: S(), nif: S(), invoice_num: S(), date_invoice: S('YYYY-MM-DD'), date_due: S('YYYY-MM-DD'), base: N(), taxes: N(), total: N() }, ['vendor', 'invoice_num']),
  fn('crear_pedido', 'Crea un pedido de compra en borrador', { vendor: S('proveedor'), lineas: { type: 'array', items: ITEM }, fecha_entrega: S('YYYY-MM-DD') }, ['vendor']),
  fn('resumen_gastos', 'Gasto en compras (facturas) por periodo', { periodo: { type: 'string', enum: ['hoy', 'esta_semana', 'este_mes', 'mes_anterior', 'este_año'] } }, ['periodo']),
  fn('gasto_por_proveedor', 'Ranking de gasto por proveedor (facturas)', { periodo: { type: 'string', enum: ['este_mes', 'mes_anterior', 'este_año', 'todo'] }, top: N('default 10') }),
  fn('informe_diario', 'Briefing del estado del negocio: facturas, pedidos, merma, precios, food cost'),
  fn('pedidos_pendientes_recibir', 'Pedidos enviados y aún no recibidos'),
  fn('alertas_subida_precio', 'Ingredientes cuyo precio ha subido comparando el último precio con el anterior del mismo proveedor', { umbral_pct: N('default 10') }),
  fn('alertas_predictivas', 'Proyección de food cost a 30/60 días, ciclos de reposición, aceleración de precios y cash flow por semana'),
  fn('registrar_merma', 'Registra una merma o pérdida', { nombre: S('producto o plato'), cantidad: N(), unidad: S('kg|g|l|ml|ud'), motivo: S('caducidad|rotura|sobreproduccion|otro'), coste_estimado: N(), fecha: S('YYYY-MM-DD'), notas: S() }, ['nombre', 'cantidad', 'unidad']),
  fn('ver_merma', 'Resumen de merma por periodo', { periodo: { type: 'string', enum: ['hoy', 'esta_semana', 'este_mes', 'mes_anterior'] }, motivo: S() }),
  fn('registrar_precio', 'Registra un precio de compra de un ingrediente y actualiza su coste', { nombre: S(), vendor: S(), precio: N(), unidad: S('unidad del precio') }, ['nombre', 'precio']),
  fn('registrar_produccion', 'Registra raciones producidas de una receta (consumo teórico)', { nombre: S('receta'), raciones: N(), fecha: S('YYYY-MM-DD') }, ['nombre', 'raciones']),
  fn('informe_semanal', 'Informe de la última semana: gasto vs semana anterior, merma, food cost, facturas, subidas de precio'),
  fn('listar_facturas_para_pagar', 'Facturas pendientes de pago como tarjeta interactiva'),
  fn('marcar_factura_pagada', 'Marca facturas como pagadas por proveedor, número o todas', { vendor: S(), invoice_num: S(), todas: B() }),
  fn('comparar_precios_proveedor', 'Compara el precio de un ingrediente entre proveedores (último precio de cada uno, en unidad base)', { nombre: S('opcional'), top: N('default 8') }),
  fn('analizar_food_cost_recetas', 'Food cost de las recetas activas con precios actuales', { umbral_pct: N('default 33') }),
  fn('calcular_compra_semanal', 'Lista de la compra para producir platos: escala por raciones, explota elaboraciones y agrupa por proveedor',
     { platos: { type: 'array', items: { type: 'object', properties: { nombre: S(), raciones: N() }, required: ['nombre', 'raciones'] } } }, ['platos']),
  fn('historial_precio_ingrediente', 'Evolución del precio de un ingrediente', { nombre: S() }, ['nombre']),
  fn('selector_pedido', 'Proveedores con sus ingredientes para elegir manualmente qué pedir'),
  fn('sugerir_items_pedido', 'Artículos habituales de un proveedor con cantidades medias', { proveedor_nombre: S() }, ['proveedor_nombre']),
  fn('analizar_necesidades_pedido', 'Qué hace falta reponer según la frecuencia habitual de compra, agrupado por proveedor'),
  fn('proponer_pedido_whatsapp', 'Prepara un pedido para enviar por WhatsApp (el usuario confirma)', { proveedor_nombre: S(), proveedor_phone: S(), items: { type: 'array', items: ITEM }, notas: S() }, ['proveedor_nombre', 'items']),
  fn('proponer_pedido_email', 'Prepara un pedido para enviar por email (el usuario confirma)', { proveedor_nombre: S(), proveedor_email: S(), items: { type: 'array', items: ITEM }, notas: S() }, ['proveedor_nombre', 'items']),
  fn('navegar', 'Lleva al usuario a una pantalla de la app', { ruta: S('ingredientes, proveedores, compras/albaranes, compras/facturas, compras/pedidos, sangrado, merma, labor, productivity, analytics, alertas, reports/daily-brief, perfil'), etiqueta: S() }, ['ruta']),
]

export const NAV_ROUTES: Record<string, string> = {
  inicio: '/dashboard', dashboard: '/dashboard', cocina: '/dashboard',
  ingredientes: '/dashboard/ingredientes', almacenes: '/dashboard/almacenes', herramientas: '/dashboard/herramientas',
  compras: '/dashboard/compras', 'compras/pedidos': '/dashboard/compras/pedidos', pedidos: '/dashboard/compras/pedidos',
  'compras/albaranes': '/dashboard/compras/albaranes', albaranes: '/dashboard/compras/albaranes', 'compras/facturas': '/dashboard/compras/facturas', facturas: '/dashboard/compras/facturas',
  proveedores: '/dashboard/proveedores', sangrado: '/dashboard/sangrado', escandallo: '/dashboard/sangrado', recetas: '/dashboard/sangrado',
  merma: '/dashboard/merma', labor: '/dashboard/labor', 'labor/empleados': '/dashboard/labor/empleados', 'labor/turnos': '/dashboard/labor/turnos', 'labor/turno-ideal': '/dashboard/labor/turno-ideal',
  productivity: '/dashboard/productivity', productividad: '/dashboard/productivity', analytics: '/dashboard/analytics', alertas: '/dashboard/alertas', ventas: '/dashboard/ventas',
  'reports/daily-brief': '/dashboard/reports/daily-brief', 'daily-brief': '/dashboard/reports/daily-brief', brief: '/dashboard/reports/daily-brief', perfil: '/dashboard/perfil',
}

/** Resultados que cortan el bucle y se devuelven como tarjeta interactiva. */
export const TERMINAL_CARDS: Record<string, string> = {
  __BRIEF_CARDS__: 'briefCards', __PEDIDO_SELECTOR__: 'pedidoSelector', __NECESIDADES_PEDIDO__: 'necesidadesPedido', __COMPRA_SEMANAL__: 'compraSemanal',
  __FACTURAS_PAGAR__: 'facturasPagar', __ALBARAN_GUARDADO__: 'albaranGuardado', __INFORME_SEMANAL__: 'informeSemanal', __INGREDIENTES_CARDS__: 'ingredientesCards',
  __PROVEEDORES_CARDS__: 'proveedoresCards', __PEDIDOS_RECIBIR_CARDS__: 'pedidosRecibirCards', __PRECIOS_ALERTA_CARDS__: 'preciosAlertaCards', __FOOD_COST_CARDS__: 'foodCostCards',
  __ALERTAS_PREDICTIVAS_CARDS__: 'alertasPredictivasCards', __WHATSAPP_PROPOSAL__: 'whatsappProposal', __NAVIGATE__: 'navigate',
}

export function suggestionsFor(actions: string): string[] {
  const a = actions || ''
  if (/registrar_merma/.test(a)) return ['Ver la merma del mes', '¿Qué platos usan ese ingrediente?']
  if (/marcar_factura_pagada|listar_facturas/.test(a)) return ['¿Qué facturas vencen esta semana?', 'Resumen de gastos del mes']
  if (/analizar_food_cost|food_cost/.test(a)) return ['¿Qué ingrediente sube el coste?', 'Compara precios entre proveedores']
  if (/analizar_necesidades_pedido|sugerir_items|calcular_compra/.test(a)) return ['Enviar el pedido por WhatsApp', 'Ver pedidos pendientes de recibir']
  if (/alertas_subida_precio|comparar_precios|historial_precio/.test(a)) return ['Buscar proveedor alternativo', 'Actualizar el coste del ingrediente']
  if (/crear_ingrediente|buscar_ingrediente/.test(a)) return ['Asignar proveedor', 'Ver ingredientes más caros']
  if (/informe_diario|informe_semanal/.test(a)) return ['¿Qué debo priorizar hoy?', 'Registrar la merma de cierre']
  return ['Dame el brief del día', '¿Qué tengo que pedir?', '¿Qué facturas debo pagar?']
}
