// Formato de números y fechas para la interfaz (es-ES).

export function eur(v: number | null | undefined, opts: { max?: number } = {}): string {
  if (v == null || !Number.isFinite(v)) return '—'
  // Un coste muy pequeño (0,002 €/l) con dos decimales parece "0,00 €": se dan más.
  const small = v !== 0 && Math.abs(v) < 0.01
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: opts.max ?? (small ? 4 : 2) }).format(v)
}

export function num(v: number | null | undefined, max = 3): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: max }).format(v)
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(digits).replace('.', ',')}%`
}

/** ISO (YYYY-MM-DD) → dd/mm/aaaa. */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function diasHasta(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.round((Date.parse(iso) - Date.parse(hoyIso())) / 86400000)
}

export const ESTADO_ALBARAN: Record<string, string> = { draft: 'Borrador', review: 'En revisión', validated: 'Validado', invoiced: 'Facturado' }
export const ESTADO_PEDIDO: Record<string, string> = { draft: 'Borrador', sent: 'Enviado', received: 'Recibido', closed: 'Cerrado', cancelled: 'Cancelado' }
export const ESTADO_FACTURA: Record<string, string> = { pending: 'Pendiente', paid: 'Pagada' }
