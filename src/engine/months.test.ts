import { describe, expect, test } from 'vitest'
import {
  addMonths,
  compareMonths,
  isMonthKey,
  monthOfDate,
  monthRange,
} from './months.ts'

describe('monthOfDate', () => {
  test('maps month boundaries', () => {
    expect(monthOfDate('2026-10-31')).toBe('2026-10')
    expect(monthOfDate('2026-11-01')).toBe('2026-11')
  })

  test('accepts a leap day', () => {
    expect(monthOfDate('2028-02-29')).toBe('2028-02')
  })

  test('rejects invalid dates', () => {
    for (const bad of [
      '2026-02-29',
      '2026-13-01',
      '2026-10-5',
      '10/05/2026',
      '',
      '2026-04-31',
    ]) {
      expect(monthOfDate(bad)).toBeNull()
    }
  })
})

describe('isMonthKey', () => {
  test('accepts YYYY-MM', () => {
    expect(isMonthKey('2026-10')).toBe(true)
  })

  test('rejects invalid month keys', () => {
    for (const bad of ['2026-00', '2026-13', '26-10', '2026-10-05']) {
      expect(isMonthKey(bad)).toBe(false)
    }
  })
})

describe('addMonths', () => {
  test('rolls year forward and backward', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-10', 14)).toBe('2027-12')
    expect(addMonths('2026-10', -22)).toBe('2024-12')
  })
})

describe('compareMonths', () => {
  test('orders months', () => {
    expect(compareMonths('2026-10', '2026-11')).toBeLessThan(0)
    expect(compareMonths('2026-11', '2026-10')).toBeGreaterThan(0)
    expect(compareMonths('2026-10', '2026-10')).toBe(0)
    expect(compareMonths('2025-12', '2026-01')).toBeLessThan(0)
  })
})

describe('monthRange', () => {
  test('inclusive range', () => {
    expect(monthRange('2026-11', '2027-02')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ])
  })

  test('single month', () => {
    expect(monthRange('2026-10', '2026-10')).toEqual(['2026-10'])
  })

  test('empty when from is after to', () => {
    expect(monthRange('2026-11', '2026-10')).toEqual([])
  })
})
