import { beforeAll, expect, test } from 'vitest'
import {
  addMonths,
  formatMonth,
  initTemporal,
  isoDate,
  monthOf,
  parseIsoDate,
  parseIsoMonth,
  temporal,
} from './dates.ts'

beforeAll(async () => {
  await initTemporal()
})
test('parseIsoDate accepts valid dates', () => {
  const r = parseIsoDate('2026-10-05')
  expect(r.ok).toBe(true)
  if (r.ok) expect(isoDate(r.value)).toBe('2026-10-05')
  expect(parseIsoDate('2028-02-29').ok).toBe(true)
})

test('parseIsoDate rejects invalid', () => {
  for (const s of ['2026-02-29', '2026-13-01', '2026-10-5', '10/05/2026', '']) {
    expect(parseIsoDate(s)).toEqual({ ok: false, error: 'invalid_date' })
  }
})

test('parseIsoMonth', () => {
  expect(parseIsoMonth('2026-10').ok).toBe(true)
  expect(parseIsoMonth('2026-00')).toEqual({ ok: false, error: 'invalid_month' })
  expect(parseIsoMonth('2026-10-05')).toEqual({ ok: false, error: 'invalid_month' })
})

test('addMonths and formatMonth', () => {
  const dec = parseIsoMonth('2026-12')
  const jan = parseIsoMonth('2026-01')
  const oct = parseIsoMonth('2026-10')
  expect(dec.ok && jan.ok && oct.ok).toBe(true)
  if (!dec.ok || !jan.ok || !oct.ok) return
  expect(addMonths(dec.value, 1).toString()).toBe('2027-01')
  expect(addMonths(jan.value, -1).toString()).toBe('2025-12')
  expect(addMonths(oct.value, 14).toString()).toBe('2027-12')
  expect(formatMonth(oct.value)).toBe('October 2026')
})

test('monthOf', () => {
  const d = parseIsoDate('2026-10-31')
  expect(d.ok).toBe(true)
  if (!d.ok) return
  expect(monthOf(d.value).toString()).toBe('2026-10')
})

test('temporal returns after init', () => {
  expect(temporal().PlainDate).toBeTruthy()
})
