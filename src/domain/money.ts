import { err, ok, type Result } from './result.ts'

export type Centavos = number & { readonly __brand: 'Centavos' }

export type MoneyParseError = 'empty' | 'invalid' | 'negative' | 'too_many_decimals' | 'too_large'

const MAX_CENTAVOS = Number.MAX_SAFE_INTEGER

export function centavos(n: number): Centavos {
  if (!Number.isSafeInteger(n)) throw new RangeError('centavos requires a safe integer')
  return n as Centavos
}

export function parseMoney(input: string): Result<Centavos, MoneyParseError> {
  let s = input.trim()
  if (s.length === 0) return err('empty')

  if (s.startsWith('₱')) {
    s = s.slice(1).trim()
    if (s.startsWith('₱')) return err('invalid')
  }

  if (s.length === 0) return err('empty')

  // Negatives (hyphen or true minus) before other invalid checks
  if (s.startsWith('-') || s.startsWith('−')) {
    const rest = s.slice(1)
    if (rest.startsWith('-') || rest.startsWith('−')) return err('invalid')
    return err('negative')
  }

  // ASCII digits, commas and a single dot only
  if (/[^\d.,]/.test(s)) return err('invalid')

  const dotCount = (s.match(/\./g) ?? []).length
  if (dotCount > 1) return err('invalid')

  // Reject european decimal comma forms like 1.200,50 (comma after a dotted whole)
  if (s.includes(',') && s.includes('.') && s.lastIndexOf(',') > s.indexOf('.')) {
    return err('invalid')
  }

  // Comma grouping: every group after the first must be exactly 3 digits
  if (s.includes(',')) {
    const wholePart = (s.split('.')[0] ?? '').split(',')
    if (wholePart.length < 2) return err('invalid')
    const first = wholePart[0] ?? ''
    if (!/^\d{1,3}$/.test(first)) return err('invalid')
    for (let i = 1; i < wholePart.length; i++) {
      if (!/^\d{3}$/.test(wholePart[i] ?? '')) return err('invalid')
    }
  }

  const normalized = s.replace(/,/g, '')
  if (normalized === '.' || normalized === '') return err('invalid')
  if (!/^\d*\.?\d*$/.test(normalized)) return err('invalid')
  let whole: string
  let frac: string
  if (normalized.includes('.')) {
    const [w = '', f = ''] = normalized.split('.')
    whole = w === '' ? '0' : w
    frac = f
  } else {
    whole = normalized
    frac = ''
  }

  if (frac.length > 2) return err('too_many_decimals')
  while (frac.length < 2) frac += '0'

  // Leading zeros ok; compare as BigInt before number conversion
  let wholeBi: bigint
  try {
    wholeBi = BigInt(whole)
  } catch {
    return err('invalid')
  }
  const fracBi = BigInt(frac)
  const total = wholeBi * 100n + fracBi
  if (total > BigInt(MAX_CENTAVOS)) return err('too_large')

  return ok(centavos(Number(total)))
}

const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
})

export function formatMoney(value: number): string {
  if (!Number.isInteger(value)) throw new RangeError('formatMoney requires an integer')
  const abs = Math.abs(value)
  const formatted = phpFormatter.format(abs / 100)
  return value < 0 ? `−${formatted}` : formatted
}
