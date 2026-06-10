'use client'

export const dynamic = 'force-dynamic'

import ProductivityOverviewPage from '../page'

// Por ahora redirigimos a la visión general (la sub-vista por franja ya es el bloque inferior).
// En Fase 1.1 vendrá el heatmap por día-x-franja.
export default function ProductivityFranjasPage() {
  return <ProductivityOverviewPage />
}
