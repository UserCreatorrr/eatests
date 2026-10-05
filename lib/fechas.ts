// Formato de fecha único para toda la app: dd/mm/aaaa.
// Las fechas llegan de sitios distintos (OCR, formularios, CSV) y en la misma
// tabla convivían "2026-08-13" y "13/08/2026". Se normaliza al pintar.
export function fechaCorta(v: string | null | undefined): string {
  if (!v) return '—'
  const s = String(v).trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const es = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
  if (es) return `${es[1].padStart(2, '0')}/${es[2].padStart(2, '0')}/${es[3]}`
  return s
}
