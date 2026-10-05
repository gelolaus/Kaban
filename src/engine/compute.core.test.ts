import { describe, expect, test } from 'vitest'
import { accountBalances, computeMonth } from './compute.ts'
import {
  assign,
  card,
  cash,
  inflow,
  normal,
  pay,
  plain,
  refund,
  snap,
  spend,
} from './test-helpers.ts'

const wallet = cash('wallet')
const groc = normal('groc')
const dine = normal('dine')

describe('G1 starting balance', () => {
  test('a 10,000.00 starting balance gives Ready to Assign 10,000.00', () => {
    const s = snap({
      accounts: [wallet],
      categories: [groc, dine],
      transactions: [inflow('s', 'wallet', '2026-10-05', 1_000_000)],
    })
    expect(computeMonth(s, '2026-10').readyToAssign).toBe(1_000_000)
    expect(accountBalances(s).wallet).toBe(1_000_000)
  })
})

describe('G2 assigning', () => {
  test('assigning lowers Ready to Assign and sets Available', () => {
    const s = snap({
      accounts: [wallet],
      categories: [groc, dine],
      transactions: [inflow('s', 'wallet', '2026-10-05', 1_000_000)],
      assignments: [
        assign('groc', '2026-10', 300_000),
        assign('dine', '2026-10', 100_000),
      ],
    })
    const v = computeMonth(s, '2026-10')
    expect(v.readyToAssign).toBe(600_000)
    expect(v.categories.groc?.available).toBe(300_000)
    expect(v.categories.dine?.available).toBe(100_000)
    expect(v.categories.groc?.assigned).toBe(300_000)
  })
})

describe('core month math', () => {
  test('assignment entries sum', () => {
    const s = snap({
      accounts: [wallet],
      categories: [groc, dine],
      transactions: [inflow('s', 'wallet', '2026-10-05', 1_000_000)],
      assignments: [
        assign('groc', '2026-10', 300_000),
        assign('groc', '2026-10', -50_000),
      ],
    })
    expect(computeMonth(s, '2026-10').categories.groc?.assigned).toBe(250_000)
  })

  test('spending reduces Available and shows negative activity', () => {
    const s = snap({
      accounts: [wallet],
      categories: [groc, dine],
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('sp1', 'wallet', '2026-10-10', 'groc', 50_000),
      ],
      assignments: [assign('groc', '2026-10', 300_000)],
    })
    const c = computeMonth(s, '2026-10').categories.groc!
    expect(c.activity).toBe(-50_000)
    expect(c.cashActivity).toBe(-50_000)
    expect(c.creditActivity).toBe(0)
    expect(c.available).toBe(250_000)
    expect(computeMonth(s, '2026-10').readyToAssign).toBe(700_000)
  })

  test('positive Available carries to the next month', () => {
    const s = snap({
      accounts: [wallet],
      categories: [groc, dine],
      transactions: [inflow('s', 'wallet', '2026-10-05', 1_000_000)],
      assignments: [assign('groc', '2026-10', 300_000)],
    })
    const oct = computeMonth(s, '2026-10')
    const nov = computeMonth(s, '2026-11')
    expect(nov.categories.groc?.carried).toBe(300_000)
    expect(nov.categories.groc?.assigned).toBe(0)
    expect(nov.categories.groc?.available).toBe(300_000)
    expect(nov.readyToAssign).toBe(oct.readyToAssign)
  })

  test('a cash refund adds to Available', () => {
    const s = snap({
      accounts: [wallet],
      categories: [groc, dine],
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('sp1', 'wallet', '2026-10-10', 'groc', 30_000),
        refund('r1', 'wallet', '2026-10-12', 'groc', 10_000),
      ],
      assignments: [assign('groc', '2026-10', 100_000)],
    })
    const c = computeMonth(s, '2026-10').categories.groc!
    expect(c.activity).toBe(-20_000)
    expect(c.available).toBe(80_000)
  })

  test('months before the first data are empty', () => {
    const s = snap({
      accounts: [wallet],
      categories: [groc, dine],
      transactions: [inflow('s', 'wallet', '2026-10-05', 1_000_000)],
      assignments: [assign('groc', '2026-10', 300_000)],
    })
    const v = computeMonth(s, '2026-09')
    expect(v.readyToAssign).toBe(0)
    expect(v.categories.groc?.available).toBe(0)
    expect(v.categories.dine?.available).toBe(0)
  })

  test('month boundaries', () => {
    const s = snap({
      accounts: [wallet],
      categories: [groc, dine],
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('sp1', 'wallet', '2026-10-31', 'groc', 10_000),
        spend('sp2', 'wallet', '2026-11-01', 'groc', 20_000),
      ],
      assignments: [assign('groc', '2026-10', 300_000)],
    })
    expect(computeMonth(s, '2026-10').categories.groc?.activity).toBe(-10_000)
    expect(computeMonth(s, '2026-11').categories.groc?.activity).toBe(-20_000)
  })
})

describe('Review Focus 4 (non-integer amounts throw)', () => {
  const badAmounts = [1.5, NaN, Infinity, -Infinity, 2 ** 53]

  for (const amount of badAmounts) {
    test(`rejects amount ${String(amount)}`, () => {
      const withInflow = snap({
        accounts: [wallet],
        categories: [groc],
        transactions: [inflow('s', 'wallet', '2026-10-05', amount)],
      })
      expect(() => computeMonth(withInflow, '2026-10')).toThrow(RangeError)
      expect(() => accountBalances(withInflow)).toThrow(RangeError)

      const withSpend = snap({
        accounts: [wallet],
        categories: [groc],
        transactions: [
          inflow('s', 'wallet', '2026-10-05', 100),
          spend('sp', 'wallet', '2026-10-06', 'groc', amount),
        ],
      })
      expect(() => computeMonth(withSpend, '2026-10')).toThrow(RangeError)

      const withAssign = snap({
        accounts: [wallet],
        categories: [groc],
        transactions: [inflow('s', 'wallet', '2026-10-05', 100)],
        assignments: [assign('groc', '2026-10', amount)],
      })
      expect(() => computeMonth(withAssign, '2026-10')).toThrow(RangeError)
    })
  }
})

describe('warnings', () => {
  test('unknown category, unknown account, and invalid date', () => {
    const s = snap({
      accounts: [wallet],
      categories: [groc, dine],
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('badCat', 'wallet', '2026-10-06', 'missing', 10_000),
        spend('badAcc', 'nope', '2026-10-07', 'groc', 10_000),
        spend('badDate', 'wallet', '2026-02-29', 'groc', 10_000),
      ],
      assignments: [assign('groc', '2026-10', 300_000)],
    })
    const v = computeMonth(s, '2026-10')
    expect(v.warnings.some((w) => w.code === 'unknown_category' && w.transactionId === 'badCat')).toBe(
      true,
    )
    expect(v.warnings.some((w) => w.code === 'unknown_account' && w.transactionId === 'badAcc')).toBe(
      true,
    )
    expect(v.warnings.some((w) => w.code === 'invalid_date' && w.transactionId === 'badDate')).toBe(
      true,
    )
    expect(v.categories.groc?.available).toBe(300_000)
    expect(v.readyToAssign).toBe(700_000)
  })
})

describe('account balances', () => {
  test('sums signed amounts and respects throughDate', () => {
    const cardA = card('cardA')
    const s = snap({
      accounts: [wallet, cardA],
      categories: [groc],
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('sp1', 'wallet', '2026-10-08', 'groc', 350_000),
        plain('p1', 'cardA', '2026-10-09', -50_000),
        pay('pay1', 'wallet', 'cardA', '2026-10-15', 20_000),
      ],
    })
    expect(accountBalances(s).wallet).toBe(630_000)
    expect(accountBalances(s).cardA).toBe(-30_000)
    expect(accountBalances(s, '2026-10-10').wallet).toBe(650_000)
    expect(accountBalances(s, '2026-10-10').cardA).toBe(-50_000)
  })
})
