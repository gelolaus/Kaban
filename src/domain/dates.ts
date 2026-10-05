import type { Temporal } from '@js-temporal/polyfill'
import { err, ok, type Result } from './result.ts'

type TemporalNs = typeof Temporal

let temporalNs: TemporalNs | undefined

export async function initTemporal(): Promise<void> {
  const g = globalThis as unknown as { Temporal?: TemporalNs }
  if (g.Temporal) {
    temporalNs = g.Temporal
    return
  }
  const mod = await import('@js-temporal/polyfill')
  temporalNs = mod.Temporal as unknown as TemporalNs
  ;(globalThis as unknown as { Temporal: TemporalNs }).Temporal = temporalNs
}

export function temporal(): TemporalNs {
  if (!temporalNs) throw new Error('Temporal not initialised')
  return temporalNs
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

export function parseIsoDate(s: string): Result<Temporal.PlainDate, 'invalid_date'> {
  if (!DATE_RE.test(s)) return err('invalid_date')
  try {
    const d = temporal().PlainDate.from(s, { overflow: 'reject' })
    return ok(d)
  } catch {
    return err('invalid_date')
  }
}

export function parseIsoMonth(s: string): Result<Temporal.PlainYearMonth, 'invalid_month'> {
  if (!MONTH_RE.test(s)) return err('invalid_month')
  try {
    const m = temporal().PlainYearMonth.from(s, { overflow: 'reject' })
    return ok(m)
  } catch {
    return err('invalid_month')
  }
}

export function isoDate(d: Temporal.PlainDate): string {
  return d.toString()
}

export function isoMonth(m: Temporal.PlainYearMonth): string {
  return m.toString()
}

export function monthOf(d: Temporal.PlainDate): Temporal.PlainYearMonth {
  return temporal().PlainYearMonth.from({ year: d.year, month: d.month })
}

export function addMonths(m: Temporal.PlainYearMonth, n: number): Temporal.PlainYearMonth {
  return m.add({ months: n })
}

export function formatMonth(m: Temporal.PlainYearMonth): string {
  const d = temporal().PlainDate.from({ year: m.year, month: m.month, day: 1 })
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}
