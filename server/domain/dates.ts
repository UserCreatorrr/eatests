// Fechas de negocio siempre como YYYY-MM-DD. Las de entrada pueden venir en
// cualquier formato (OCR, CSV, formularios); aquí se normalizan una vez.

const ISO = /^(\d{4})-(\d{2})-(\d{2})/
const ES = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/

export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string') return false
  const m = ISO.exec(v)
  if (!m || v.length !== 10) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

/** Acepta "2026-08-13", "2026-08-13T10:00", "13/08/2026", "13-8-2026". */
export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  const iso = ISO.exec(s)
  if (iso) { const d = `${iso[1]}-${iso[2]}-${iso[3]}`; return isIsoDate(d) ? d : null }
  const es = ES.exec(s)
  if (es) { const d = `${es[3]}-${es[2].padStart(2, '0')}-${es[1].padStart(2, '0')}`; return isIsoDate(d) ? d : null }
  return null
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** dd/mm/aaaa para pantalla. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = ISO.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const HM = /^([0-1]\d|2[0-3]):([0-5]\d)$/
export function isHm(v: unknown): v is string {
  return typeof v === 'string' && HM.test(v)
}
export function parseHm(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = /^(\d{1,2})[:.h](\d{2})/.exec(String(raw).trim())
  if (!m) return null
  const hm = `${m[1].padStart(2, '0')}:${m[2]}`
  return isHm(hm) ? hm : null
}
