import { describe, expect, it } from 'vitest'
import { amountsReconcile, round2, toCents } from '@/server/domain/money'
import { formatDate, isIsoDate, parseDate, parseHm } from '@/server/domain/dates'
import { assertDeliveryNoteTransition, assertOrderTransition } from '@/server/domain/states'
import { ConflictError } from '@/server/domain/errors'

describe('dinero', () => {
  it('céntimos enteros y cuadre con tolerancia', () => {
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(round2(2.675)).toBe(2.68)
    expect(amountsReconcile(10000, 2100, 12100)).toBe(true)
    expect(amountsReconcile(10000, 2100, 12102)).toBe(true)
    expect(amountsReconcile(10000, 2100, 12400)).toBe(false)
  })
})

describe('fechas', () => {
  it('normaliza los dos formatos que había en producción', () => {
    expect(parseDate('2026-08-13')).toBe('2026-08-13')
    expect(parseDate('13/08/2026')).toBe('2026-08-13')
    expect(parseDate('2026-08-13T10:22:00Z')).toBe('2026-08-13')
    expect(parseDate('31/02/2026')).toBeNull()
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(formatDate('2026-08-13')).toBe('13/08/2026')
    expect(parseHm('9:05')).toBe('09:05')
    expect(parseHm('25:00')).toBeNull()
  })
})

describe('estados', () => {
  it('solo permite las transiciones definidas', () => {
    expect(() => assertOrderTransition('draft', 'sent')).not.toThrow()
    expect(() => assertOrderTransition('draft', 'closed')).toThrow(ConflictError)
    expect(() => assertOrderTransition('closed', 'draft')).toThrow(ConflictError)
    expect(() => assertDeliveryNoteTransition('validated', 'invoiced')).not.toThrow()
    expect(() => assertDeliveryNoteTransition('invoiced', 'draft')).toThrow(ConflictError)
    expect(() => assertDeliveryNoteTransition('draft', 'draft')).toThrow(ConflictError)
  })
})

import { matchByName as matchNames } from '@/server/domain/text'
describe('cruce por nombre', () => {
  const cat = [{ name: 'Pechuga de pollo' }, { name: 'Tomate' }, { name: 'Tomate pera rama' }, { name: 'Aceite de oliva virgen' }, { name: 'Pollo entero' }]
  it('exacto, por palabras y el mejor entre varios parciales', () => {
    expect(matchNames('pechuga pollo', cat)).toEqual({ item: { name: 'Pechuga de pollo' }, kind: 'partial' })
    expect(matchNames('TOMATE', cat)).toEqual({ item: { name: 'Tomate' }, kind: 'exact' })
    expect(matchNames('tomates pera', cat)?.item.name).toBe('Tomate pera rama')
    expect(matchNames('aceite oliva', cat)?.item.name).toBe('Aceite de oliva virgen')
    expect(matchNames('pollo', cat)?.item.name).toBe('Pollo entero')
    expect(matchNames('sal', cat)).toBeNull()
    expect(matchNames('', cat)).toBeNull()
  })
})
