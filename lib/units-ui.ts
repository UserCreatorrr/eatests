// Vocabulario de unidades para desplegables. La definición canónica vive en
// server/domain/units.ts; aquí solo las etiquetas.
export const UNIT_OPTIONS: { value: string; label: string; dim: 'mass' | 'volume' | 'count' }[] = [
  { value: 'kg', label: 'kg (kilogramo)', dim: 'mass' },
  { value: 'g', label: 'g (gramo)', dim: 'mass' },
  { value: 'mg', label: 'mg (miligramo)', dim: 'mass' },
  { value: 'l', label: 'l (litro)', dim: 'volume' },
  { value: 'cl', label: 'cl (centilitro)', dim: 'volume' },
  { value: 'ml', label: 'ml (mililitro)', dim: 'volume' },
  { value: 'ud', label: 'ud (unidad)', dim: 'count' },
  { value: 'docena', label: 'docena', dim: 'count' },
]

export const BASE_UNIT_OPTIONS = UNIT_OPTIONS.filter(u => ['kg', 'l', 'ud', 'g', 'ml', 'docena'].includes(u.value))

export function dimOf(u: string | null | undefined): 'mass' | 'volume' | 'count' | null {
  return UNIT_OPTIONS.find(x => x.value === (u ?? '').toLowerCase())?.dim ?? null
}

export function unitsCompatibleWith(u: string | null | undefined) {
  const d = dimOf(u)
  return d ? UNIT_OPTIONS.filter(x => x.dim === d) : UNIT_OPTIONS
}

export const IVA_OPTIONS = [0, 4, 10, 21]
