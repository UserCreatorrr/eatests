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
