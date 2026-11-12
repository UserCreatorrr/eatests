// Catálogo cerrado de unidades con su magnitud física. Es el mismo que impone
// la base de datos por CHECK: lo que no esté aquí no se guarda.
// Causa raíz histórica de los food cost absurdos: "Manojo", "Kg" y "kg" eran
// tres cadenas distintas.

export type Dimension = 'mass' | 'volume' | 'count'
export type Unit = 'kg' | 'g' | 'mg' | 'l' | 'cl' | 'ml' | 'ud' | 'docena'

export interface UnitDef {
  code: Unit
  label: string
  dim: Dimension
  base: Unit          // unidad base de su magnitud (la de compra)
  toBase: number      // cuántas unidades base es 1 de esta
}

export const UNITS: readonly UnitDef[] = [
  { code: 'kg',     label: 'kg (kilogramo)',  dim: 'mass',   base: 'kg', toBase: 1 },
  { code: 'g',      label: 'g (gramo)',       dim: 'mass',   base: 'kg', toBase: 0.001 },
  { code: 'mg',     label: 'mg (miligramo)',  dim: 'mass',   base: 'kg', toBase: 0.000001 },
  { code: 'l',      label: 'l (litro)',       dim: 'volume', base: 'l',  toBase: 1 },
  { code: 'cl',     label: 'cl (centilitro)', dim: 'volume', base: 'l',  toBase: 0.01 },
  { code: 'ml',     label: 'ml (mililitro)',  dim: 'volume', base: 'l',  toBase: 0.001 },
  { code: 'ud',     label: 'ud (unidad)',     dim: 'count',  base: 'ud', toBase: 1 },
  { code: 'docena', label: 'docena',          dim: 'count',  base: 'ud', toBase: 12 },
]

const BY_CODE = new Map(UNITS.map(u => [u.code, u]))

// Sinónimos que llegan de Excel, OCR o datos antiguos.
const SYNONYMS: Record<string, Unit> = {
  kg: 'kg', kilo: 'kg', kilos: 'kg', kgs: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  g: 'g', gr: 'g', grs: 'g', gramo: 'g', gramos: 'g',
  mg: 'mg',
  l: 'l', lt: 'l', lts: 'l', litro: 'l', litros: 'l',
  cl: 'cl',
  ml: 'ml', cc: 'ml',
  ud: 'ud', u: 'ud', uds: 'ud', unidad: 'ud', unidades: 'ud', pieza: 'ud', piezas: 'ud', pza: 'ud', pz: 'ud',
  docena: 'docena', docenas: 'docena', doc: 'docena',
}

/** Normaliza cualquier variante escrita a una unidad del catálogo, o null. */
export function parseUnit(raw: string | null | undefined): Unit | null {
  if (!raw) return null
  const k = String(raw).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\.$/, '')
  return SYNONYMS[k] ?? null
}

export function isUnit(v: unknown): v is Unit {
  return typeof v === 'string' && BY_CODE.has(v as Unit)
}

export function unitDef(u: Unit): UnitDef {
  return BY_CODE.get(u)!
}

export function dimensionOf(u: Unit): Dimension {
  return unitDef(u).dim
}

/** false si son de magnitudes distintas (kg frente a l, ud frente a g). */
export function compatible(a: Unit, b: Unit): boolean {
  return dimensionOf(a) === dimensionOf(b)
}

/** Unidad de compra de una unidad de receta: g→kg, ml→l, docena→ud. */
export function baseUnitOf(u: Unit): Unit {
  return unitDef(u).base
}

export function unitsCompatibleWith(u: Unit): UnitDef[] {
  const d = dimensionOf(u)
  return UNITS.filter(x => x.dim === d)
}

/**
 * Factor para expresar una cantidad en `from` en la unidad `to`.
 * Lanza si las magnitudes no coinciden: eso nunca es un "1 por defecto".
 */
export function conversionFactor(from: Unit, to: Unit): number {
  if (from === to) return 1
  const a = unitDef(from), b = unitDef(to)
  if (a.dim !== b.dim) throw new Error(`Unidades incompatibles: ${from} y ${to}`)
  return a.toBase / b.toBase
}

export function convert(qty: number, from: Unit, to: Unit): number {
  return qty * conversionFactor(from, to)
}
