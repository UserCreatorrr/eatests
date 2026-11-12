// Normalización de texto para cruzar nombres (catálogo, OCR, Excel).

/** Minúsculas, sin acentos, espacios colapsados. */
export function norm(v: unknown): string {
  if (v == null) return ''
  return String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Número en formato europeo o anglosajón: "1.450,80" · "11,50" · "0.05" · "12 €". */
export function parseNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).replace(/[€\s%]/g, '').replace(/[^\d.,-]/g, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (s.includes(',')) s = s.replace(',', '.')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'sin', 'en', 'a', 'al', 'un', 'una'])

/** Raíz tosca: sin plural ni -e final ("tomates", "tomate" → "tomat"; "coles", "col" → "col"). */
function stem(t: string): string {
  if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1)
  if (t.length > 4 && t.endsWith('e')) t = t.slice(0, -1)
  return t
}

/** Palabras significativas, en raíz, sin artículos ni preposiciones. */
export function tokens(v: unknown): string[] {
  return norm(v).split(/[^a-z0-9ñ]+/).filter(t => t.length > 1 && !STOPWORDS.has(t)).map(stem)
}

export interface Named { name: string }

/**
 * Cruce por nombre: exacto normalizado; si no, por palabras ("pechuga pollo"
 * casa con "Pechuga de pollo"; "tomate" con "Tomate pera"). Entre varios
 * parciales gana el que menos palabras sobrantes tiene. Devuelve el tipo de
 * coincidencia para que la UI avise de los aproximados.
 */
export function matchByName<T extends Named>(name: string, catalog: T[]): { item: T; kind: 'exact' | 'partial' } | null {
  const k = norm(name)
  if (!k) return null
  const exact = catalog.find(c => norm(c.name) === k)
  if (exact) return { item: exact, kind: 'exact' }
  const q = tokens(name)
  if (!q.length) return null
  let best: { item: T; score: number } | null = null
  for (const c of catalog) {
    const ct = tokens(c.name)
    if (!ct.length) continue
    const qInC = q.every(t => ct.includes(t)), cInQ = ct.every(t => q.includes(t))
    if (!qInC && !cInQ) continue
    // Menos palabras sobrantes = mejor; la contención completa de la consulta
    // pesa más; a igualdad, gana el que comparte el sustantivo principal (el primero).
    const score = (qInC ? 100 : 50) - Math.abs(ct.length - q.length) * 2 + (ct[0] === q[0] ? 1 : 0)
    if (!best || score > best.score) best = { item: c, score }
  }
  return best ? { item: best.item, kind: 'partial' } : null
}
