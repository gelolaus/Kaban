import { describe, expect, test } from 'vitest'
import { accountBalances, computeMonth } from './compute.ts'
import {
  assign,
  card,
  cash,
  inflow,
  normal,
  pay,
  payment,
  plain,
  refund,
  snap,
  spend,
} from './test-helpers.ts'

const wallet = cash('wallet')
const cardA = card('cardA')
const cardB = card('cardB')
const groc = normal('groc')
const dine = normal('dine')
const payA = payment('payA', 'cardA')
const payB = payment('payB', 'cardB')

function baseG4() {
  return snap({
    accounts: [wallet, cardA, cardB],
    categories: [groc, dine, payA, payB],
    transactions: [inflow('s', 'wallet', '2026-10-05', 1_000_000)],
    assignments: [
      assign('groc', '2026-10', 300_000),
      assign('dine', '2026-10', 100_000),
    ],
  })
}

describe('G4 credit overspending', () => {
  test('credit overspending is not deducted from Ready to Assign', () => {
    const s = snap({
      ...baseG4(),
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('sp1', 'wallet', '2026-10-10', 'groc', 350_000),
        spend('sp2', 'cardA', '2026-10-12', 'dine', 120_000),
      ],
    })
    const oct = computeMonth(s, '2026-10')
    expect(oct.categories.dine?.available).toBe(-20_000)
    expect(oct.categories.dine?.creditOverspending).toBe(20_000)
    expect(oct.categories.dine?.cashOverspending).toBe(0)
    expect(oct.categories.dine?.creditActivity).toBe(-120_000)
    expect(oct.categories.payA?.activity).toBe(100_000)
    expect(oct.categories.payA?.available).toBe(100_000)
    expect(oct.readyToAssign).toBe(600_000)
    expect(oct.summary).toMatchObject({
      leftOver: 0,
      assigned: 400_000,
      activity: -370_000,
      available: 30_000,
    })

    const nov = computeMonth(s, '2026-11')
    expect(nov.categories.dine?.available).toBe(0)
    expect(nov.categories.payA?.carried).toBe(100_000)
    expect(nov.categories.payA?.available).toBe(100_000)
    expect(nov.readyToAssign).toBe(550_000)

    expect(accountBalances(s).wallet).toBe(650_000)
    expect(accountBalances(s).cardA).toBe(-120_000)
  })
})

describe('credit card payment categories', () => {
  test('fully covered card spending', () => {
    const s = snap({
      ...baseG4(),
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('sp2', 'cardA', '2026-10-12', 'dine', 60_000),
      ],
    })
    const oct = computeMonth(s, '2026-10')
    expect(oct.categories.dine?.available).toBe(40_000)
    expect(oct.categories.dine?.creditOverspending).toBe(0)
    expect(oct.categories.payA?.activity).toBe(60_000)
  })

  test('a payment reduces the payment category (R5b, documented)', () => {
    const s = snap({
      ...baseG4(),
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('sp2', 'cardA', '2026-10-12', 'dine', 60_000),
        pay('p1', 'wallet', 'cardA', '2026-10-20', 30_000),
      ],
    })
    const oct = computeMonth(s, '2026-10')
    expect(oct.categories.payA?.activity).toBe(30_000)
    expect(oct.categories.payA?.available).toBe(30_000)
    expect(accountBalances(s).wallet).toBe(970_000)
    expect(accountBalances(s).cardA).toBe(-30_000)

    const full = snap({
      ...baseG4(),
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('sp2', 'cardA', '2026-10-12', 'dine', 60_000),
        pay('p1', 'wallet', 'cardA', '2026-10-20', 60_000),
      ],
    })
    expect(computeMonth(full, '2026-10').categories.payA?.available).toBe(0)
    expect(accountBalances(full).cardA).toBe(0)
  })

  test('payment with no card spending', () => {
    const s = snap({
      ...baseG4(),
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        pay('p1', 'wallet', 'cardA', '2026-10-20', 20_000),
      ],
    })
    expect(computeMonth(s, '2026-10').categories.payA?.available).toBe(-20_000)
  })

  test('overpaying is cash overspending (R5c, assumed)', () => {
    const s = snap({
      ...baseG4(),
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('sp2', 'cardA', '2026-10-12', 'dine', 60_000),
        pay('p1', 'wallet', 'cardA', '2026-10-20', 80_000),
      ],
    })
    const oct = computeMonth(s, '2026-10')
    expect(oct.categories.payA?.available).toBe(-20_000)
    expect(oct.categories.payA?.cashOverspending).toBe(20_000)
    const nov = computeMonth(s, '2026-11')
    expect(nov.categories.payA?.available).toBe(0)
    expect(nov.readyToAssign).toBe(oct.readyToAssign - 20_000)
  })

  test('two cards, not enough funds', () => {
    const s = snap({
      accounts: [wallet, cardA, cardB],
      categories: [groc, dine, payA, payB],
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('spA', 'cardA', '2026-10-01', 'dine', 70_000),
        spend('spB', 'cardB', '2026-10-02', 'dine', 70_000),
      ],
      assignments: [assign('dine', '2026-10', 100_000)],
    })
    const oct = computeMonth(s, '2026-10')
    expect(oct.categories.dine?.available).toBe(-40_000)
    expect(oct.categories.dine?.creditOverspending).toBe(40_000)
    expect(oct.categories.payA?.activity).toBe(70_000)
    expect(oct.categories.payB?.activity).toBe(30_000)
  })

  test('a credit card starting balance does not touch the budget', () => {
    const s = snap({
      ...baseG4(),
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        plain('d', 'cardA', '2026-10-01', -50_000),
      ],
    })
    const oct = computeMonth(s, '2026-10')
    expect(accountBalances(s).cardA).toBe(-50_000)
    expect(oct.readyToAssign).toBe(600_000)
    expect(oct.categories.groc?.available).toBe(300_000)
    expect(oct.categories.dine?.available).toBe(100_000)
    expect(oct.categories.payA?.available).toBe(0)
  })

  test('credit refunds are unsupported', () => {
    const s = snap({
      ...baseG4(),
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('sp2', 'cardA', '2026-10-12', 'dine', 60_000),
        refund('rf', 'cardA', '2026-10-15', 'dine', 10_000),
      ],
    })
    const oct = computeMonth(s, '2026-10')
    expect(oct.warnings.some((w) => w.code === 'unsupported' && w.transactionId === 'rf')).toBe(
      true,
    )
    expect(oct.categories.dine?.activity).toBe(-60_000)
    expect(oct.categories.dine?.available).toBe(40_000)
    expect(accountBalances(s).cardA).toBe(-50_000)
  })

  test('a category with credit spending but no payment category for that card', () => {
    const s = snap({
      accounts: [wallet, cardA],
      categories: [groc, dine],
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('sp2', 'cardA', '2026-10-12', 'dine', 120_000),
      ],
      assignments: [assign('dine', '2026-10', 100_000)],
    })
    const oct = computeMonth(s, '2026-10')
    expect(oct.warnings.some((w) => w.code === 'unknown_category' && w.transactionId === 'sp2')).toBe(
      true,
    )
    expect(oct.categories.dine?.available).toBe(-20_000)
    expect(oct.categories.dine?.creditOverspending).toBe(20_000)
  })
})

describe('documented but not yet verified in the app (R4b)', () => {
  test('(a) cash first when funds cover cash spend', () => {
    const s = snap({
      accounts: [wallet, cardA],
      categories: [dine, payA],
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('c1', 'wallet', '2026-10-10', 'dine', 80_000),
        spend('c2', 'cardA', '2026-10-11', 'dine', 60_000),
      ],
      assignments: [assign('dine', '2026-10', 100_000)],
    })
    const oct = computeMonth(s, '2026-10')
    expect(oct.categories.dine?.cashOverspending).toBe(0)
    expect(oct.categories.dine?.creditOverspending).toBe(40_000)
    expect(oct.categories.payA?.activity).toBe(20_000)
    expect(oct.categories.dine?.available).toBe(-40_000)
    expect(computeMonth(s, '2026-11').readyToAssign).toBe(oct.readyToAssign)
  })

  test('(b) cash shortfall when cash spend exceeds funds', () => {
    const s = snap({
      accounts: [wallet, cardA],
      categories: [dine, payA],
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('c1', 'wallet', '2026-10-10', 'dine', 80_000),
        spend('c2', 'cardA', '2026-10-11', 'dine', 60_000),
      ],
      assignments: [assign('dine', '2026-10', 50_000)],
    })
    const oct = computeMonth(s, '2026-10')
    expect(oct.categories.dine?.cashOverspending).toBe(30_000)
    expect(oct.categories.dine?.creditOverspending).toBe(60_000)
    expect(oct.categories.payA?.activity).toBe(0)
    expect(oct.categories.dine?.available).toBe(-90_000)
    expect(computeMonth(s, '2026-11').readyToAssign).toBe(oct.readyToAssign - 30_000)
  })
})
