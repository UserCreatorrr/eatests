import { describe, expect, it } from 'vitest'
import { baseUnitOf, compatible, conversionFactor, convert, parseUnit, unitsCompatibleWith } from '@/server/domain/units'

describe('unidades', () => {
  it('normaliza variantes escritas', () => {
    expect(parseUnit('Kg')).toBe('kg')
    expect(parseUnit(' Lt ')).toBe('l')
    expect(parseUnit('gr.')).toBe('g')
    expect(parseUnit('Unidades')).toBe('ud')
    expect(parseUnit('Tarro')).toBeNull()
    expect(parseUnit('Manojo')).toBeNull()
    expect(parseUnit(null)).toBeNull()
  })
  it('convierte dentro de la misma magnitud', () => {
    expect(convert(180, 'g', 'kg')).toBeCloseTo(0.18, 10)
    expect(convert(2, 'kg', 'g')).toBe(2000)
    expect(convert(75, 'cl', 'l')).toBeCloseTo(0.75, 10)
    expect(convert(1, 'docena', 'ud')).toBe(12)
    expect(conversionFactor('ml', 'ml')).toBe(1)
  })
  it('se niega a convertir entre magnitudes', () => {
    expect(() => conversionFactor('ud', 'kg')).toThrow(/incompatibles/)
    expect(compatible('g', 'l')).toBe(false)
    expect(compatible('g', 'kg')).toBe(true)
  })
  it('conoce la unidad de compra', () => {
    expect(baseUnitOf('g')).toBe('kg')
    expect(baseUnitOf('ml')).toBe('l')
    expect(baseUnitOf('docena')).toBe('ud')
    expect(unitsCompatibleWith('kg').map(u => u.code)).toEqual(['kg', 'g', 'mg'])
  })
})
