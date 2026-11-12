// Lectura de fichas técnicas de receta en Excel (formato Connatura y
// parecidos). La ficha es maquetación libre, no una tabla: cabecera con
// etiqueta/valor, tabla de ingredientes y bloque de procedimiento. Por eso
// todo se localiza por ETIQUETA, nunca por coordenadas fijas.
import { norm, parseNumber } from './text'

export type Cell = string | number | null | undefined
export type Grid = Cell[][]

export interface ImportedLine {
  name: string
  unit: string | null
  grossQty: number | null      // lo que se compra o consume
  wastePct: number | null      // % merma declarado
  netQty: number | null        // lo que acaba en el plato
  price: number | null         // €/unidad si la ficha lo trae
  supplier: string | null
  allergen: string | null
  note: string | null
}

export interface ProcedureStep { step: string | null; stage: string | null; text: string | null; time: string | null; temperature: string | null; equipment: string | null; control: string | null }

export interface ImportedRecipe {
  sheet: string
  name: string | null
  code: string | null
  family: string | null
  portions: number | null
  netYield: number | null
  gramsPerPortion: number | null
  salePrice: number | null
  description: string | null
  allergens: string | null
  conservation: string | null
  regeneration: string | null
  notes: string | null
  procedure: ProcedureStep[]
  lines: ImportedLine[]
  warnings: string[]
}

const txt = (v: Cell): string => (v == null ? '' : String(v).trim())

/** La merma puede venir como fracción (0,05) o como porcentaje (5). */
function wastePct(v: Cell): number | null {
  const n = parseNumber(v)
  if (n == null || n < 0) return null
  return n <= 1 ? Math.round(n * 1000) / 10 : Math.round(n * 10) / 10
}

/** Fila con el mismo texto repetido en muchas celdas: banda de cabecera o marca. */
function isBanner(row: Cell[]): boolean {
  const vals = row.map(txt).filter(Boolean)
  return vals.length >= 4 && new Set(vals.map(norm)).size === 1
}

const KNOWN_LABELS = ['codigo', 'familia', 'produccion base', 'rendimiento', 'gramos', 'coste', 'precio', 'food cost', 'alergenos', 'definicion', 'fotografia', 'ingredientes', 'procedimiento', 'conservacion', 'regeneracion', 'observaciones']

function looksLikeLabel(v: string): boolean {
  const n = norm(v)
  return !!n && KNOWN_LABELS.some(e => n === e || n.startsWith(e))
}

/** Primer valor a la derecha; se detiene si encuentra otra etiqueta. */
function valueRight(grid: Grid, row: number, col: number): string | null {
  const r = grid[row] || []
  for (let c = col + 1; c < r.length; c++) {
    const v = txt(r[c])
    if (!v || norm(v) === norm(r[col])) continue
    if (looksLikeLabel(v)) return null
    return v
  }
  return null
}

export function labelValue(grid: Grid, labels: string[]): string | null {
  const targets = labels.map(norm)
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || []
    for (let c = 0; c < row.length; c++) {
      const cell = norm(row[c])
      if (!cell || !targets.some(t => cell === t || cell.startsWith(t))) continue
      const right = valueRight(grid, r, c)
      if (right) return right
      const below = txt((grid[r + 1] || [])[c])
      if (below && !targets.some(t => norm(below).startsWith(t))) return below
    }
  }
  return null
}

type Cols = Record<string, number>

function findIngredientTable(grid: Grid): { row: number; cols: Cols } | null {
  for (let r = 0; r < grid.length; r++) {
    const row = (grid[r] || []).map(norm)
    const hasName = row.some(v => v === 'ingrediente' || v === 'ingredientes' || v === 'producto')
    const hasUnit = row.some(v => v.startsWith('unidad') || v === 'ud' || v === 'um')
    if (!hasName || !hasUnit) continue
    const cols: Cols = {}
    row.forEach((v, c) => {
      if (!v) return
      if (cols.name == null && (v === 'ingrediente' || v === 'ingredientes' || v === 'producto')) cols.name = c
      else if (cols.unit == null && (v.startsWith('unidad') || v === 'ud' || v === 'um')) cols.unit = c
      else if (cols.waste == null && v.startsWith('merma')) cols.waste = c
      else if (cols.net == null && v.includes('neta')) cols.net = c
      else if (cols.gross == null && v.includes('bruta')) cols.gross = c
      else if (cols.price == null && v.startsWith('precio')) cols.price = c
      else if (cols.cost == null && v.startsWith('coste')) cols.cost = c
      else if (cols.supplier == null && v.startsWith('proveedor')) cols.supplier = c
      else if (cols.allergen == null && v.startsWith('alergeno')) cols.allergen = c
      else if (cols.note == null && (v.startsWith('funcion') || v.includes('especificacion') || v.startsWith('observ'))) cols.note = c
      // "Cantidad 25 p." son columnas de escalado: se ignoran, el escandallo guarda el lote base.
      else if (cols.gross == null && cols.net == null && v.startsWith('cantidad') && !/\d/.test(v)) cols.gross = c
    })
    if (cols.name != null) return { row: r, cols }
  }
  return null
}

function readLines(grid: Grid, start: number, cols: Cols): ImportedLine[] {
  const lines: ImportedLine[] = []
  let blank = 0
  for (let r = start + 1; r < grid.length; r++) {
    const row = grid[r] || []
    const name = txt(row[cols.name])
    if (!name) { if (++blank >= 3) break; continue }
    const n = norm(name)
    if (n.startsWith('total') || n.startsWith('subtotal') || n.startsWith('procedimiento')) break
    blank = 0
    const gross = cols.gross != null ? parseNumber(row[cols.gross]) : null
    const net = cols.net != null ? parseNumber(row[cols.net]) : null
    lines.push({
      name, unit: cols.unit != null ? txt(row[cols.unit]) || null : null,
      grossQty: gross ?? net, wastePct: cols.waste != null ? wastePct(row[cols.waste]) : null, netQty: net,
      price: cols.price != null ? parseNumber(row[cols.price]) : null,
      supplier: cols.supplier != null ? txt(row[cols.supplier]) || null : null,
      allergen: cols.allergen != null ? txt(row[cols.allergen]) || null : null,
      note: cols.note != null ? txt(row[cols.note]) || null : null,
    })
  }
  return lines
}

function readProcedure(grid: Grid): ProcedureStep[] {
  for (let r = 0; r < grid.length; r++) {
    const row = (grid[r] || []).map(norm)
    if (!row.some(v => v === 'paso') || !row.some(v => v.startsWith('procedimiento'))) continue
    const c: Cols = {}
    row.forEach((v, i) => {
      if (v === 'paso' && c.step == null) c.step = i
      else if (v.startsWith('etapa') && c.stage == null) c.stage = i
      else if (v.startsWith('procedimiento') && c.text == null) c.text = i
      else if (v.startsWith('tiempo') && c.time == null) c.time = i
      else if (v.startsWith('temperatura') && c.temp == null) c.temp = i
      else if (v.startsWith('equipo') && c.equipment == null) c.equipment = i
      else if (v.includes('control') && c.control == null) c.control = i
    })
    const steps: ProcedureStep[] = []
    let blank = 0
    for (let i = r + 1; i < grid.length; i++) {
      const f = grid[i] || []
      const text = c.text != null ? txt(f[c.text]) : ''
      const step = c.step != null ? txt(f[c.step]) : ''
      if (!text && !step) { if (++blank >= 2) break; continue }
      if (looksLikeLabel(step) || looksLikeLabel(text)) break
      if (!text && parseNumber(step) == null) break
      blank = 0
      steps.push({ step: step || null, stage: c.stage != null ? txt(f[c.stage]) || null : null, text: text || null, time: c.time != null ? txt(f[c.time]) || null : null,
                   temperature: c.temp != null ? txt(f[c.temp]) || null : null, equipment: c.equipment != null ? txt(f[c.equipment]) || null : null, control: c.control != null ? txt(f[c.control]) || null : null })
    }
    return steps
  }
  return []
}

function detectName(grid: Grid): string | null {
  for (let r = 0; r < Math.min(grid.length, 14); r++) {
    const row = grid[r] || []
    if (isBanner(row)) continue
    const first = row.map(txt).find(Boolean)
    if (!first) continue
    const n = norm(first)
    if (n.length < 4 || looksLikeLabel(first) || parseNumber(first) != null) continue
    return first
  }
  return null
}

export function parseRecipeSheet(sheet: string, grid: Grid): ImportedRecipe {
  const warnings: string[] = []
  const table = findIngredientTable(grid)
  const lines = table ? readLines(grid, table.row, table.cols) : []
  if (!table) warnings.push('No se ha encontrado la tabla de ingredientes (se busca una fila con "Ingrediente" y "Unidad").')
  else if (lines.length === 0) warnings.push('Se encontró la tabla de ingredientes pero no tiene filas con datos.')

  const production = labelValue(grid, ['produccion base', 'porciones', 'raciones'])
  const portions = production ? parseNumber(production.replace(/[^\d.,]/g, ' ')) : null

  const recipe: ImportedRecipe = {
    sheet, name: detectName(grid), code: labelValue(grid, ['codigo']) || sheet || null, family: labelValue(grid, ['familia', 'categoria']),
    portions: portions != null ? Math.round(portions) : null,
    netYield: parseNumber(labelValue(grid, ['rendimiento neto', 'rendimiento'])),
    gramsPerPortion: parseNumber(labelValue(grid, ['gramos / porcion', 'gramos por porcion', 'gramos'])),
    salePrice: parseNumber(labelValue(grid, ['precio objetivo / porcion', 'precio objetivo', 'pvp', 'precio de venta'])),
    description: labelValue(grid, ['definicion de la elaboracion', 'definicion', 'descripcion']),
    allergens: labelValue(grid, ['alergenos y restricciones', 'alergenos']),
    conservation: labelValue(grid, ['conservacion']), regeneration: labelValue(grid, ['regeneracion']),
    notes: labelValue(grid, ['observaciones de prueba', 'observaciones']),
    procedure: readProcedure(grid), lines, warnings,
  }
  if (!recipe.name) warnings.push('No se ha detectado el nombre de la receta; se puede escribir en la revisión.')
  if (!recipe.portions) warnings.push('No se ha detectado el número de porciones; sin él no hay coste por ración.')
  const noPrice = lines.filter(l => l.price == null).length
  if (noPrice) warnings.push(`${noPrice} ingrediente(s) sin precio en el Excel: se tomará el coste del catálogo si ya existe.`)
  const noQty = lines.filter(l => l.grossQty == null).length
  if (noQty) warnings.push(`${noQty} ingrediente(s) sin cantidad: revísalos antes de guardar.`)
  return recipe
}

/**
 * Cantidad y merma que se guardan en la línea. El motor parte de la NETA y
 * aplica la merma para recuperar la bruta. Con solo bruta, se guarda la bruta
 * con merma 0, o el coste la inflaría dos veces.
 */
export function qtyAndWaste(l: { grossQty: number | null; netQty: number | null; wastePct: number | null }): { qty: number; wastePct: number } {
  const w = l.wastePct && l.wastePct > 0 ? l.wastePct : 0
  if (w && l.netQty && l.netQty > 0) return { qty: l.netQty, wastePct: w }
  return { qty: l.grossQty ?? l.netQty ?? 0, wastePct: 0 }
}
