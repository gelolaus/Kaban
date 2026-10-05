import { describe, expect, test } from 'vitest'
import { computeMonth } from './compute.ts'
import { assign, cash, inflow, normal, refund, snap, spend } from './test-helpers.ts'

const base = () =>
  snap({
    accounts: [cash('wallet')],
    categories: [normal('groc'), normal('dine')],
    transactions: [inflow('s', 'wallet', '2026-10-05', 1_000_000)],
    assignments: [assign('groc', '2026-10', 300_000), assign('dine', '2026-10', 100_000)],
  })

test('G3 cash overspending resets next month and lowers next month Ready to Assign', () => {
  const s = snap({
    ...base(),
    transactions: [
      inflow('s', 'wallet', '2026-10-05', 1_000_000),
      spend('g1', 'wallet', '2026-10-10', 'groc', 350_000),
    ],
  })
  const oct = computeMonth(s, '2026-10')
  expect(oct.categories.groc?.available).toBe(-50_000)
  expect(oct.categories.groc?.cashOverspending).toBe(50_000)
  expect(oct.readyToAssign).toBe(600_000)

  const nov = computeMonth(s, '2026-11')
  expect(nov.categories.groc?.carried).toBe(0)
  expect(nov.categories.groc?.available).toBe(0)
  expect(nov.readyToAssign).toBe(550_000)
})

test('the deduction persists in later months', () => {
  const s = snap({
    ...base(),
    transactions: [
      inflow('s', 'wallet', '2026-10-05', 1_000_000),
      spend('g1', 'wallet', '2026-10-10', 'groc', 350_000),
    ],
  })
  for (const m of ['2026-11', '2026-12', '2027-01'] as const) {
    expect(computeMonth(s, m).readyToAssign).toBe(550_000)
  }
  expect(computeMonth(s, '2027-01').categories.dine?.available).toBe(100_000)
})

test('assigning after an overspend is fresh money', () => {
  const s = snap({
    ...base(),
    transactions: [
      inflow('s', 'wallet', '2026-10-05', 1_000_000),
      spend('g1', 'wallet', '2026-10-10', 'groc', 350_000),
    ],
    assignments: [
      assign('groc', '2026-10', 300_000),
      assign('dine', '2026-10', 100_000),
      assign('groc', '2026-11', 50_000),
    ],
  })
  const nov = computeMonth(s, '2026-11')
  expect(nov.categories.groc?.available).toBe(50_000)
  expect(nov.readyToAssign).toBe(500_000)
})

test('a cash refund while overspent', () => {
  const s = snap({
    accounts: [cash('wallet')],
    categories: [normal('groc')],
    transactions: [
      spend('g1', 'wallet', '2026-10-10', 'groc', 50_000),
      refund('r1', 'wallet', '2026-10-11', 'groc', 20_000),
    ],
  })
  const oct = computeMonth(s, '2026-10')
  expect(oct.categories.groc?.available).toBe(-30_000)
  expect(oct.categories.groc?.cashOverspending).toBe(30_000)
})

test('two overspent categories deduct the sum', () => {
  const s = snap({
    accounts: [cash('wallet')],
    categories: [normal('groc'), normal('dine')],
    transactions: [
      inflow('s', 'wallet', '2026-10-05', 1_000_000),
      spend('g1', 'wallet', '2026-10-10', 'groc', 20_000),
      spend('d1', 'wallet', '2026-10-10', 'dine', 20_000),
    ],
  })
  expect(computeMonth(s, '2026-11').readyToAssign).toBe(960_000)
})

test('an exactly spent category is not overspent', () => {
  const s = snap({
    ...base(),
    transactions: [
      inflow('s', 'wallet', '2026-10-05', 1_000_000),
      spend('g1', 'wallet', '2026-10-10', 'groc', 300_000),
    ],
  })
  const oct = computeMonth(s, '2026-10')
  expect(oct.categories.groc?.available).toBe(0)
  expect(oct.categories.groc?.cashOverspending).toBe(0)
  expect(computeMonth(s, '2026-11').readyToAssign).toBe(oct.readyToAssign)
})

describe('placeholder', () => {
  test('file loads', () => {
    expect(true).toBe(true)
  })
})
