export type MonthKey = string

const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function isMonthKey(s: string): boolean {
  return MONTH_KEY_RE.test(s)
}

export function monthOfDate(date: string): MonthKey | null {
  const match = DATE_RE.exec(date)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return null
  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1]!
  if (day < 1 || day > maxDay) return null
  return `${match[1]}-${match[2]}`
}

export function addMonths(m: MonthKey, n: number): MonthKey {
  if (!isMonthKey(m)) {
    throw new RangeError(`invalid MonthKey: ${m}`)
  }
  if (!Number.isInteger(n)) {
    throw new RangeError(`n must be an integer: ${n}`)
  }
  const year = Number(m.slice(0, 4))
  const month = Number(m.slice(5, 7))
  const absolute = year * 12 + (month - 1) + n
  const newYear = Math.floor(absolute / 12)
  const newMonth = (absolute % 12) + 1
  return `${String(newYear).padStart(4, '0')}-${String(newMonth).padStart(2, '0')}`
}

export function compareMonths(a: MonthKey, b: MonthKey): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  if (!isMonthKey(from) || !isMonthKey(to)) {
    throw new RangeError(`invalid MonthKey in monthRange: ${from}..${to}`)
  }
  if (compareMonths(from, to) > 0) return []
  const out: MonthKey[] = []
  let cur = from
  for (;;) {
    out.push(cur)
    if (cur === to) break
    cur = addMonths(cur, 1)
  }
  return out
}

function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29
  return DAYS_IN_MONTH[month - 1]!
}

/** Weekday: 0 = Sunday … 6 = Saturday. */
export function countWeekdayInMonth(month: MonthKey, weekday: number): number {
  if (!isMonthKey(month)) throw new RangeError(`invalid MonthKey: ${month}`)
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new RangeError(`weekday must be 0..6: ${weekday}`)
  }
  const year = Number(month.slice(0, 4))
  const mon = Number(month.slice(5, 7))
  const dim = daysInMonth(year, mon)
  // Date.UTC day-of-week: 0 Sunday
  let count = 0
  for (let day = 1; day <= dim; day++) {
    if (new Date(Date.UTC(year, mon - 1, day)).getUTCDay() === weekday) count++
  }
  return count
}

/** Inclusive months from `from` through `dueMonth`. */
export function monthsLeftThrough(from: MonthKey, dueMonth: MonthKey): number {
  if (!isMonthKey(from) || !isMonthKey(dueMonth)) {
    throw new RangeError(`invalid MonthKey in monthsLeftThrough: ${from}..${dueMonth}`)
  }
  if (compareMonths(from, dueMonth) > 0) return 0
  return monthRange(from, dueMonth).length
}
