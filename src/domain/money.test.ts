import { describe, expect, test } from 'vitest'
import { formatMoney, parseMoney } from './money.ts'

describe('parseMoney accepts', () => {
  const cases: Array<[string, number]> = [
    ['1,200.50', 120050],
    ['1200', 120000],
    ['.5', 50],
    ['5.', 500],
    ['0', 0],
    ['₱ 1,200.00', 120000],
    ['  12.3  ', 1230],
    ['1,000,000.00', 100000000],
    ['90071992547409.91', 9007199254740991],
  ]
  for (const [input, expected] of cases) {
    test(`parses ${JSON.stringify(input)}`, () => {
      const r = parseMoney(input)
      expect(r).toEqual({ ok: true, value: expected })
    })
  }
})

describe('parseMoney rejects', () => {
  test('empty', () => {
    expect(parseMoney('')).toEqual({ ok: false, error: 'empty' })
    expect(parseMoney('   ')).toEqual({ ok: false, error: 'empty' })
  })

  const invalid = ['abc', '1.200,50', '1,2,00', '１２００', '1e3', '12..5', '₱₱5', '--5']
  for (const input of invalid) {
    test(`invalid ${JSON.stringify(input)}`, () => {
      expect(parseMoney(input)).toEqual({ ok: false, error: 'invalid' })
    })
  }

  test('negative', () => {
    expect(parseMoney('-5')).toEqual({ ok: false, error: 'negative' })
    expect(parseMoney('-0')).toEqual({ ok: false, error: 'negative' })
    expect(parseMoney('−5')).toEqual({ ok: false, error: 'negative' })
  })

  test('too many decimals', () => {
    expect(parseMoney('12.345')).toEqual({ ok: false, error: 'too_many_decimals' })
  })

  test('too large', () => {
    expect(parseMoney('99999999999999999999')).toEqual({ ok: false, error: 'too_large' })
    expect(parseMoney('90071992547409.92')).toEqual({ ok: false, error: 'too_large' })
  })
})

describe('formatMoney', () => {
  test('formats integers', () => {
    expect(formatMoney(0)).toBe('₱0.00')
    expect(formatMoney(120050)).toBe('₱1,200.50')
    expect(formatMoney(-50000)).toBe('−₱500.00')
    expect(formatMoney(1)).toBe('₱0.01')
    expect(formatMoney(-1)).toBe('−₱0.01')
    expect(formatMoney(100000000)).toBe('₱1,000,000.00')
  })

  test('rejects non-integers', () => {
    expect(() => formatMoney(1.5)).toThrow(RangeError)
  })
})

describe('round trip', () => {
  const amounts = [0, 1, 99, 100, 120050, 999999999]
  for (const n of amounts) {
    test(`round trips ${n}`, () => {
      const formatted = formatMoney(n).replace('−', '-')
      const r = parseMoney(formatted)
      expect(r).toEqual({ ok: true, value: n })
    })
  }

  test('negative formatted money is rejected as negative', () => {
    const formatted = formatMoney(-100).replace('−', '-')
    expect(parseMoney(formatted)).toEqual({ ok: false, error: 'negative' })
  })
})
