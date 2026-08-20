// Food cost — normalización de unidades y fórmulas validadas.
// Evita food costs absurdos (miles de %) por mezclar g con €/kg, ml con €/l, etc.

// Fragmento SQL reutilizable: coste de una línea de escandallo NORMALIZANDO
// la unidad de la línea contra la unidad del ingrediente (g↔kg, ml↔l, cl↔l).
// Requiere los alias: l (escandallo_lineas), i (ingredientes, LEFT JOIN).
export const COSTE_LINEA_SQL = `(
  COALESCE(l.cantidad, 0) *
  COALESCE(CASE WHEN l.ingrediente_id IS NOT NULL AND i.cost IS NOT NULL THEN i.cost ELSE l.coste_unitario END, 0) *
  CASE
    WHEN lower(COALESCE(l.unidad,'')) IN ('g','gr','gramo','gramos','grs') AND lower(COALESCE(i.unit,'')) IN ('kg','kilo','kilos','kgs') THEN 0.001
    WHEN lower(COALESCE(l.unidad,'')) IN ('ml','cc')                       AND lower(COALESCE(i.unit,'')) IN ('l','lt','litro','litros','lts') THEN 0.001
    WHEN lower(COALESCE(l.unidad,'')) = 'cl'                               AND lower(COALESCE(i.unit,'')) IN ('l','lt','litro','litros') THEN 0.01
    WHEN lower(COALESCE(l.unidad,'')) = 'mg'                               AND lower(COALESCE(i.unit,'')) IN ('kg','kilo','kilos') THEN 0.000001
    ELSE 1
  END
)`

// Raciones de la receta para cálculos por ración (alias r = escandallo_receta).
// El food cost % se calcula SIEMPRE por ración: (coste_total / raciones) / pvp.
export const RACIONES_SQL = `COALESCE(NULLIF(r.raciones, 0), 1)`

// ─── Vocabulario CERRADO de unidades ───────────────────────────────────────
// Causa raíz de los food cost absurdos: la unidad era texto libre, así que se
// podía escribir "Manojo" en un ingrediente cuyas recetas estaban en gramos.
// Aquí queda un catálogo fijo con su dimensión física, y toda la app elige de él.

export type Dimension = 'masa' | 'volumen' | 'discreta'

export interface UnidadDef {
  code: string        // valor que se guarda en BD
  label: string       // lo que ve el usuario
  dim: Dimension
  base: string        // unidad base de su dimensión
  factorBase: number  // cuántas unidades base es 1 de esta
}

export const UNIDADES: UnidadDef[] = [
  { code: 'kg', label: 'kg (kilogramo)',  dim: 'masa',      base: 'kg', factorBase: 1 },
  { code: 'g',  label: 'g (gramo)',       dim: 'masa',      base: 'kg', factorBase: 0.001 },
  { code: 'mg', label: 'mg (miligramo)',  dim: 'masa',      base: 'kg', factorBase: 0.000001 },
  { code: 'l',  label: 'l (litro)',       dim: 'volumen',   base: 'l',  factorBase: 1 },
  { code: 'cl', label: 'cl (centilitro)', dim: 'volumen',   base: 'l',  factorBase: 0.01 },
  { code: 'ml', label: 'ml (mililitro)',  dim: 'volumen',   base: 'l',  factorBase: 0.001 },
  { code: 'ud', label: 'ud (unidad)',     dim: 'discreta',  base: 'ud', factorBase: 1 },
  { code: 'docena', label: 'docena',      dim: 'discreta',  base: 'ud', factorBase: 12 },
]

// Sinónimos que llegan de Excel, OCR o datos antiguos → código canónico.
const SINONIMOS: Record<string, string> = {
  kg: 'kg', kilo: 'kg', kilos: 'kg', kgs: 'kg', 'kilogramo': 'kg', 'kilogramos': 'kg',
  g: 'g', gr: 'g', grs: 'g', gramo: 'g', gramos: 'g',
  mg: 'mg',
  l: 'l', lt: 'l', lts: 'l', litro: 'l', litros: 'l',
  cl: 'cl',
  ml: 'ml', cc: 'ml',
  ud: 'ud', u: 'ud', uds: 'ud', unidad: 'ud', unidades: 'ud', pieza: 'ud', piezas: 'ud',
  docena: 'docena', docenas: 'docena',
}

/** Normaliza cualquier variante escrita a un código del vocabulario, o null. */
export function unidadCanonica(u: string | null | undefined): string | null {
  if (!u) return null
  const k = String(u).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  return SINONIMOS[k] ?? null
}

export function unidadDef(u: string | null | undefined): UnidadDef | null {
  const c = unidadCanonica(u)
  return c ? (UNIDADES.find(x => x.code === c) ?? null) : null
}

/** Dimensión física de una unidad; null si no pertenece al vocabulario. */
export function dimensionUnidad(u: string | null | undefined): Dimension | null {
  return unidadDef(u)?.dim ?? null
}

/** false solo si ambas unidades son conocidas y de dimensiones distintas.
 *  Con una unidad desconocida no se bloquea, se deja pasar y se avisa aparte. */
export function unidadesCompatibles(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = dimensionUnidad(a), dbb = dimensionUnidad(b)
  if (!da || !dbb) return true
  return da === dbb
}

/** Unidad de COMPRA de una unidad de receta: g→kg, ml→l, ud→ud.
 *  Las fichas dan cantidades en g/ml pero los precios en €/kg·L·ud. */
export function unidadBaseCompra(u: string | null | undefined): string {
  const d = unidadDef(u)
  return d ? d.base : ((u || 'ud').trim() || 'ud')
}

/** Unidades que se pueden usar en una línea cuyo ingrediente está en `unidadIng`. */
export function unidadesCompatiblesCon(unidadIng: string | null | undefined): UnidadDef[] {
  const d = dimensionUnidad(unidadIng)
  return d ? UNIDADES.filter(u => u.dim === d) : UNIDADES
}

// Factor para convertir la cantidad de una línea a la unidad base del ingrediente.
// Ej: línea en 'g', ingrediente en 'kg' → 0.001  (180 g → 0.18 kg)
export function unitFactor(lineUnit: string | null | undefined, ingUnit: string | null | undefined): number {
  const a = norm(lineUnit)
  const b = norm(ingUnit)
  if (!a || !b || a === b) return 1
  // masa
  if (a === 'g' && b === 'kg') return 0.001
  if (a === 'kg' && b === 'g') return 1000
  if (a === 'mg' && b === 'kg') return 0.000001
  if (a === 'mg' && b === 'g') return 0.001
  // volumen
  if (a === 'ml' && b === 'l') return 0.001
  if (a === 'l' && b === 'ml') return 1000
  if (a === 'cl' && b === 'l') return 0.01
  // unidades / docenas
  if (a === 'ud' && b === 'docena') return 1 / 12
  if (a === 'docena' && b === 'ud') return 12
  return 1
}

function norm(u: string | null | undefined): string {
  if (!u) return ''
  const s = u.toLowerCase().trim()
  const map: Record<string, string> = {
    'kg': 'kg', 'kilo': 'kg', 'kilos': 'kg', 'kgs': 'kg',
    'g': 'g', 'gr': 'g', 'gramo': 'g', 'gramos': 'g', 'grs': 'g',
    'mg': 'mg',
    'l': 'l', 'lt': 'l', 'litro': 'l', 'litros': 'l', 'lts': 'l',
    'ml': 'ml', 'cc': 'ml',
    'cl': 'cl',
    'ud': 'ud', 'uds': 'ud', 'u': 'ud', 'unidad': 'ud', 'unidades': 'ud', 'pieza': 'ud', 'piezas': 'ud',
    'docena': 'docena', 'docenas': 'docena',
  }
  return map[s] ?? s
}

// Coste real de una línea de escandallo, normalizando unidades.
// cantidad: en lineUnit. coste: € por ingUnit (o por lineUnit si no hay ingUnit).
export function lineCost(
  cantidad: number | null | undefined,
  lineUnit: string | null | undefined,
  coste: number | null | undefined,
  ingUnit?: string | null | undefined,
): number {
  const q = cantidad ?? 0
  const c = coste ?? 0
  if (q <= 0 || c <= 0) return 0
  const factor = ingUnit ? unitFactor(lineUnit, ingUnit) : 1
  return q * factor * c
}

export interface FoodCostResult {
  coste_total: number
  food_cost_pct: number | null
  margen_bruto: number | null
  pvp_sugerido: number | null     // para alcanzar 30% FC
  nivel: 'excelente' | 'saludable' | 'revisar' | 'critico' | 'sin_pvp'
  valido: boolean                 // false si las cifras son incoherentes (no mostrar alerta)
}

// Calcula food cost de una receta a partir del coste total y el PVP.
// Devuelve `valido=false` si el resultado es matemáticamente incoherente
// (FC negativo, > 300%, coste/pvp absurdos) — para no mostrar alertas falsas.
export function foodCost(costeTotal: number, precioVenta: number | null | undefined, targetPct = 30): FoodCostResult {
  const coste = Math.max(0, Math.round(costeTotal * 10000) / 10000)
  const pvp = precioVenta ?? 0

  const pvpSugerido = coste > 0 ? Math.ceil((coste / (targetPct / 100)) * 100) / 100 : null

  if (!pvp || pvp <= 0) {
    return { coste_total: coste, food_cost_pct: null, margen_bruto: null, pvp_sugerido: pvpSugerido, nivel: 'sin_pvp', valido: coste > 0 }
  }

  const pct = (coste / pvp) * 100
  const margen = pvp - coste

  // Guard rails: un food cost > 300% o < 0% casi siempre indica error de datos
  const valido = pct >= 0 && pct <= 300

  const nivel: FoodCostResult['nivel'] =
    pct > 40 ? 'critico' : pct > 33 ? 'revisar' : pct > 25 ? 'saludable' : 'excelente'

  return {
    coste_total: coste,
    food_cost_pct: Math.round(pct),
    margen_bruto: Math.round(margen * 100) / 100,
    pvp_sugerido: pvpSugerido,
    nivel,
    valido,
  }
}
