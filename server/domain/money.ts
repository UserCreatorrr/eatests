// Importes de documentos en céntimos enteros: nada de 0.1 + 0.2.
// Los precios unitarios (€/kg) siguen siendo decimales porque se multiplican
// por cantidades; el redondeo a céntimo se hace una sola vez, al final.

export function toCents(euros: number | null | undefined): number {
  if (euros == null || !Number.isFinite(euros)) return 0
  return Math.round(euros * 100)
}

export function fromCents(cents: number | null | undefined): number {
  return (cents ?? 0) / 100
}

/** Redondeo monetario a 2 decimales sin el sesgo de toFixed con binarios. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000
}

/**
 * ¿Cuadran base + IVA con el total? Tolerancia de 2 céntimos o el 1% del
 * total, lo que sea mayor (los proveedores redondean línea a línea).
 */
export function amountsReconcile(baseCents: number, vatCents: number, totalCents: number): boolean {
  if (totalCents <= 0) return true
  const tol = Math.max(2, Math.round(totalCents * 0.01))
  return Math.abs(baseCents + vatCents - totalCents) <= tol
}

export function formatEur(cents: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(fromCents(cents))
}
