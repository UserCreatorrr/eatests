// Motor de coste del escandallo — ÚNICA fuente de verdad.
//
// Hasta ahora el coste de una receta se calculaba con un fragmento SQL repetido
// en 5 endpoints. Eso funciona mientras una línea sea un ingrediente suelto,
// pero no resuelve dos cosas que pide cualquier cocina real:
//
//   1. SUBRECETAS (elaboraciones intermedias). Una salsa madre es una receta
//      que se usa como línea de otras. Su coste es recursivo: para saber lo que
//      cuestan 200 ml de salsa hay que escandallar antes la salsa entera.
//   2. MERMA por línea. Si de 1 kg de alcachofa se aprovechan 600 g, el plato
//      no cuesta lo que pesa en el plato: cuesta lo que sale del almacén.
//
// Convenio de la merma (importante, y el motivo de que se guarde así):
//   `cantidad` es la cantidad NETA, la que acaba en el plato.
//   consumo real = cantidad / (1 - merma/100)
//   Ej: 1900 g netos con 5% de merma = 2000 g brutos, que es justo lo que
//   descuenta el almacén. Guardar la bruta y aplicar la merma encima la
//   contaría dos veces.
import db from './db'
import { unitFactor, foodCost } from './foodcost'

export interface LineaCoste {
  id: number
  nombre: string
  tipo: 'ingrediente' | 'subreceta' | 'libre'
  ingrediente_id: number | null
  subreceta_id: number | null
  cantidad: number          // neta, tal cual la teclea el cocinero
  unidad: string | null
  merma_pct: number
  cantidad_bruta: number    // la que sale del almacén (neta + merma)
  coste_unitario: number    // € por unidad de la línea, ya convertida
  coste: number             // € que aporta la línea a la receta
  aviso: string | null      // por qué esta línea no suma (dato incompleto, ciclo…)
}

export interface CosteReceta {
  receta_id: number
  nombre: string
  coste_total: number
  raciones: number
  coste_racion: number
  precio_venta: number | null
  food_cost_pct: number | null
  /** € por unidad producida — lo que cuesta usarla como subreceta */
  coste_unidad_producida: number | null
  cantidad_producida: number | null
  unidad_producida: string | null
  es_subreceta: boolean
  lineas: LineaCoste[]
  /** Líneas que no han podido costearse (sin precio, ciclo, etc.) */
  incompletas: number
  ciclo: boolean
}

interface RecetaRow {
  id: number; nombre: string; raciones: number | null; precio_venta: number | null
  es_subreceta: number | null; cantidad_producida: number | null; unidad_producida: string | null
}
interface LineaRow {
  id: number; receta_id: number; ingrediente_id: number | null; subreceta_id: number | null
  nombre_libre: string | null; cantidad: number | null; unidad: string | null
  coste_unitario: number | null; merma_pct: number | null
}

/** Multiplicador de consumo por merma. 0% → 1; 25% → 1,333… */
export function factorMerma(mermaPct: number | null | undefined): number {
  const m = Number(mermaPct ?? 0)
  if (!Number.isFinite(m) || m <= 0) return 1
  // Una merma del 100% haría infinito el consumo: se topa en 95%.
  const seguro = Math.min(m, 95)
  return 1 / (1 - seguro / 100)
}

/**
 * Calcula el coste de TODAS las recetas de un usuario en una sola pasada.
 * Resuelve subrecetas en profundidad, con memoización y detección de ciclos
 * (receta A que se usa en B que se usa en A: se corta y se marca el aviso).
 */
export function costesRecetas(userId: string): Map<number, CosteReceta> {
  const recetas = db.prepare(
    `SELECT id, nombre, raciones, precio_venta, es_subreceta, cantidad_producida, unidad_producida
       FROM escandallo_receta WHERE user_id = ?`
  ).all(userId) as RecetaRow[]

  const lineas = db.prepare(
    `SELECT id, receta_id, ingrediente_id, subreceta_id, nombre_libre, cantidad, unidad,
            coste_unitario, merma_pct
       FROM escandallo_lineas WHERE user_id = ?`
  ).all(userId) as LineaRow[]

  const ingredientes = new Map<number, { descr: string; unit: string | null; cost: number | null }>()
  for (const r of db.prepare(`SELECT id, descr, unit, cost FROM ingredientes WHERE user_id = ?`).all(userId) as any[]) {
    ingredientes.set(r.id, { descr: r.descr, unit: r.unit, cost: r.cost })
  }

  const porReceta = new Map<number, LineaRow[]>()
  for (const l of lineas) {
    if (!porReceta.has(l.receta_id)) porReceta.set(l.receta_id, [])
    porReceta.get(l.receta_id)!.push(l)
  }

  const cache = new Map<number, CosteReceta>()
  const enCurso = new Set<number>()   // pila del DFS: lo que hay aquí es un ciclo

  function resolver(rec: RecetaRow): CosteReceta {
    const ya = cache.get(rec.id)
    if (ya) return ya

    const raciones = rec.raciones && rec.raciones > 0 ? rec.raciones : 1
    const base: CosteReceta = {
      receta_id: rec.id, nombre: rec.nombre, coste_total: 0, raciones,
      coste_racion: 0, precio_venta: rec.precio_venta, food_cost_pct: null,
      coste_unidad_producida: null,
      cantidad_producida: rec.cantidad_producida, unidad_producida: rec.unidad_producida,
      es_subreceta: !!rec.es_subreceta, lineas: [], incompletas: 0, ciclo: false,
    }

    if (enCurso.has(rec.id)) { base.ciclo = true; return base }   // no se cachea: es parcial
    enCurso.add(rec.id)

    let total = 0
    for (const l of porReceta.get(rec.id) ?? []) {
      const lc = costeDeLinea(l)
      base.lineas.push(lc)
      if (lc.aviso) base.incompletas++
      if (lc.ciclo) base.ciclo = true
      total += lc.coste
    }

    enCurso.delete(rec.id)

    base.coste_total = Math.round(total * 10000) / 10000
    base.coste_racion = Math.round((base.coste_total / raciones) * 10000) / 10000

    // Coste por unidad producida: lo que vale usarla dentro de otra receta.
    // Si no se ha declarado producción, se reparte por raciones (1 ración = 1 ud).
    // Sin redondear: el redondeo aquí se multiplica por la cantidad usada y
    // desplaza el coste del plato (0,0019025 €/g redondeado a 6 decimales ya
    // sobrevalora 200 g). Se redondea al final, no en el camino.
    const producida = rec.cantidad_producida && rec.cantidad_producida > 0 ? rec.cantidad_producida : null
    base.coste_unidad_producida = producida ? base.coste_total / producida : base.coste_racion

    // foodCost() solo se usa para el guard rail (descartar cifras imposibles).
    // El porcentaje se guarda con dos decimales: un 7,7% redondeado a 8% cambia
    // el lado del umbral en el que cae un plato.
    const fc = foodCost(base.coste_racion, rec.precio_venta)
    base.food_cost_pct = fc.valido && rec.precio_venta
      ? Math.round((base.coste_racion / rec.precio_venta) * 10000) / 100
      : null

    cache.set(rec.id, base)
    return base
  }

  function costeDeLinea(l: LineaRow): LineaCoste & { ciclo?: boolean } {
    const cantidad = Number(l.cantidad ?? 0)
    const merma = Number(l.merma_pct ?? 0)
    const bruta = Math.round(cantidad * factorMerma(merma) * 10000) / 10000

    const out: LineaCoste & { ciclo?: boolean } = {
      id: l.id, nombre: l.nombre_libre ?? '', tipo: 'libre',
      ingrediente_id: l.ingrediente_id, subreceta_id: l.subreceta_id,
      cantidad, unidad: l.unidad, merma_pct: merma, cantidad_bruta: bruta,
      coste_unitario: 0, coste: 0, aviso: null,
    }

    // ── Línea que es otra receta ────────────────────────────────────────
    if (l.subreceta_id) {
      out.tipo = 'subreceta'
      const sub = recetas.find(r => r.id === l.subreceta_id)
      if (!sub) { out.aviso = 'La elaboración enlazada ya no existe'; return out }
      out.nombre = sub.nombre

      if (enCurso.has(sub.id)) {
        out.aviso = `"${sub.nombre}" se usa a sí misma (referencia circular)`
        out.ciclo = true
        return out
      }

      const costeSub = resolver(sub)
      const unidadSub = sub.cantidad_producida && sub.cantidad_producida > 0 ? sub.unidad_producida : 'ud'
      const porUnidad = costeSub.coste_unidad_producida ?? 0
      if (porUnidad <= 0) { out.aviso = `"${sub.nombre}" todavía no tiene coste (faltan precios)`; return out }

      const factor = unitFactor(l.unidad, unidadSub)
      out.coste_unitario = Math.round(porUnidad * factor * 1000000) / 1000000
      out.coste = Math.round(bruta * factor * porUnidad * 10000) / 10000
      return out
    }

    // ── Línea de ingrediente ────────────────────────────────────────────
    if (l.ingrediente_id) {
      out.tipo = 'ingrediente'
      const ing = ingredientes.get(l.ingrediente_id)
      if (!ing) { out.aviso = 'El ingrediente ya no existe'; return out }
      out.nombre = ing.descr ?? out.nombre
      const precio = Number(ing.cost ?? 0)
      if (!(precio > 0)) { out.aviso = `"${ing.descr}" no tiene precio de compra`; return out }
      const factor = unitFactor(l.unidad, ing.unit)
      out.coste_unitario = Math.round(precio * factor * 1000000) / 1000000
      out.coste = Math.round(bruta * factor * precio * 10000) / 10000
      return out
    }

    // ── Línea escrita a mano, con su propio precio ───────────────────────
    const cu = Number(l.coste_unitario ?? 0)
    if (!(cu > 0)) { out.aviso = 'Línea sin precio'; return out }
    out.coste_unitario = cu
    out.coste = Math.round(bruta * cu * 10000) / 10000
    return out
  }

  const res = new Map<number, CosteReceta>()
  for (const r of recetas) res.set(r.id, resolver(r))
  return res
}

/**
 * Platos activos con food cost por encima del umbral, de peor a mejor.
 * Se descartan los > 300%: eso no es un plato caro, es un dato mal metido, y
 * avisar de él solo genera ruido.
 */
export function recetasCriticas(userId: string, umbralPct = 35, limite = 5): Array<{
  nombre: string; precio_venta: number; coste_racion: number; pct: number
}> {
  const activas = new Set(
    (db.prepare(`SELECT id FROM escandallo_receta WHERE user_id = ? AND activo = 1`).all(userId) as any[])
      .map(r => r.id)
  )
  return Array.from(costesRecetas(userId).values())
    .filter(r => activas.has(r.receta_id) && (r.precio_venta ?? 0) > 0 && r.coste_racion > 0)
    .map(r => ({
      nombre: r.nombre,
      precio_venta: r.precio_venta as number,
      coste_racion: r.coste_racion,
      pct: Math.round((r.coste_racion / (r.precio_venta as number)) * 100),
    }))
    .filter(r => r.pct > umbralPct && r.pct <= 300)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limite)
}

/** Coste de una sola receta (resuelve igualmente sus subrecetas). */
export function costeReceta(userId: string, recetaId: number): CosteReceta | null {
  return costesRecetas(userId).get(recetaId) ?? null
}

export interface ConsumoIngrediente {
  ingrediente_id: number | null
  nombre: string
  cantidad: number      // bruta, en la unidad de COMPRA del ingrediente
  unidad: string | null
}

/**
 * Descompone una receta en los ingredientes que realmente salen del almacén.
 * Una línea que es una elaboración no se consume como tal: se consume la parte
 * proporcional de SUS ingredientes, y así hasta el fondo. Es lo que hay que
 * comparar contra los albaranes de compra.
 */
export function explosionIngredientes(userId: string, recetaId: number): ConsumoIngrediente[] {
  const costes = costesRecetas(userId)
  const recetas = new Map(
    (db.prepare(`SELECT id, cantidad_producida, unidad_producida FROM escandallo_receta WHERE user_id = ?`)
      .all(userId) as any[]).map(r => [r.id, r])
  )
  const ingredientes = new Map(
    (db.prepare(`SELECT id, descr, unit FROM ingredientes WHERE user_id = ?`).all(userId) as any[])
      .map(i => [i.id, i])
  )

  const acumulado = new Map<string, ConsumoIngrediente>()
  const visitadas = new Set<number>()

  function bajar(id: number, multiplicador: number) {
    if (visitadas.has(id)) return        // corta ciclos
    visitadas.add(id)
    const c = costes.get(id)
    if (c) {
      for (const l of c.lineas) {
        const bruta = l.cantidad_bruta * multiplicador
        if (l.subreceta_id) {
          const sub = recetas.get(l.subreceta_id)
          const producida = sub?.cantidad_producida
          if (!producida || producida <= 0) continue
          // La línea pide `bruta` de lo que la elaboración produce: se baja esa fracción.
          const factor = unitFactor(l.unidad, sub.unidad_producida)
          bajar(l.subreceta_id, (bruta * factor) / producida)
          continue
        }
        const ing = l.ingrediente_id ? ingredientes.get(l.ingrediente_id) : null
        const unidad = ing ? ing.unit : l.unidad
        const cantidad = ing ? bruta * unitFactor(l.unidad, ing.unit) : bruta
        const clave = ing ? `i${ing.id}` : `l${(l.nombre || '').toLowerCase()}`
        const ya = acumulado.get(clave)
        if (ya) ya.cantidad += cantidad
        else acumulado.set(clave, {
          ingrediente_id: l.ingrediente_id,
          nombre: ing ? ing.descr : l.nombre,
          cantidad, unidad,
        })
      }
    }
    visitadas.delete(id)
  }

  bajar(recetaId, 1)
  return Array.from(acumulado.values())
    .map(c => ({ ...c, cantidad: Math.round(c.cantidad * 100000) / 100000 }))
}

/**
 * Recetas que se pueden usar como subreceta DENTRO de `recetaId` sin crear un
 * ciclo. Se excluye ella misma y cualquiera que, directa o indirectamente, ya
 * la use a ella (si B usa A, A no puede usar B).
 */
export function subrecetasDisponibles(userId: string, recetaId: number | null): Array<{
  id: number; nombre: string; coste_unidad_producida: number | null
  cantidad_producida: number | null; unidad_producida: string | null
}> {
  const todas = costesRecetas(userId)
  const usadaPor = new Map<number, Set<number>>()   // receta → quién la usa
  for (const l of db.prepare(
    `SELECT receta_id, subreceta_id FROM escandallo_lineas WHERE user_id = ? AND subreceta_id IS NOT NULL`
  ).all(userId) as any[]) {
    if (!usadaPor.has(l.subreceta_id)) usadaPor.set(l.subreceta_id, new Set())
    usadaPor.get(l.subreceta_id)!.add(l.receta_id)
  }

  // Todo lo que depende (a cualquier profundidad) de la receta actual.
  const prohibidas = new Set<number>()
  if (recetaId) {
    const pila = [recetaId]
    while (pila.length) {
      const actual = pila.pop()!
      if (prohibidas.has(actual)) continue
      prohibidas.add(actual)
      const padres = usadaPor.get(actual)
      if (padres) padres.forEach(p => pila.push(p))
    }
  }

  return Array.from(todas.values())
    .filter(r => !prohibidas.has(r.receta_id))
    .map(r => ({
      id: r.receta_id, nombre: r.nombre,
      coste_unidad_producida: r.coste_unidad_producida,
      cantidad_producida: r.cantidad_producida,
      unidad_producida: r.unidad_producida,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** true si añadir `subrecetaId` a `recetaId` crearía una referencia circular. */
export function creariaCiclo(userId: string, recetaId: number, subrecetaId: number): boolean {
  if (recetaId === subrecetaId) return true
  const lineas = db.prepare(
    `SELECT receta_id, subreceta_id FROM escandallo_lineas WHERE user_id = ? AND subreceta_id IS NOT NULL`
  ).all(userId) as Array<{ receta_id: number; subreceta_id: number }>
  // ¿Se llega desde subrecetaId hasta recetaId bajando por sus subrecetas?
  const pila = [subrecetaId]
  const vistas = new Set<number>()
  while (pila.length) {
    const actual = pila.pop()!
    if (actual === recetaId) return true
    if (vistas.has(actual)) continue
    vistas.add(actual)
    for (const l of lineas) if (l.receta_id === actual) pila.push(l.subreceta_id)
  }
  return false
}
