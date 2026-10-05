import { describe, expect, test } from 'vitest'
import { computeMonth } from './compute.ts'
import {
  assign,
  card,
  cash,
  inflow,
  normal,
  payment,
  snap,
  spend,
} from './test-helpers.ts'

const wallet = cash('wallet')
const cardA = card('cardA')
const groc = normal('groc')
const dine = normal('dine')
const payA = payment('payA', 'cardA')

function g4Snapshot() {
  return snap({
    accounts: [wallet, cardA],
    categories: [groc, dine, payA],
    transactions: [
      inflow('s', 'wallet', '2026-10-05', 1_000_000),
      spend('sp1', 'wallet', '2026-10-10', 'groc', 350_000),
      spend('sp2', 'cardA', '2026-10-12', 'dine', 120_000),
    ],
    assignments: [
      assign('groc', '2026-10', 300_000),
      assign('dine', '2026-10', 100_000),
    ],
  })
}

describe('month summary', () => {
  test('October summary matches G4 figures', () => {
    const oct = computeMonth(g4Snapshot(), '2026-10')
    expect(oct.summary).toMatchObject({
      leftOver: 0,
      assigned: 400_000,
      activity: -370_000,
      available: 30_000,
    })
  })

  test('November summary after G4 carry', () => {
    const nov = computeMonth(g4Snapshot(), '2026-11')
    expect(nov.summary).toMatchObject({
      leftOver: 100_000,
      assigned: 0,
      activity: 0,
      available: 100_000,
    })
  })

  test('snapshot with no categories', () => {
    const s = snap({
      accounts: [wallet],
      transactions: [inflow('s', 'wallet', '2026-10-05', 1_000_000)],
    })
    const v = computeMonth(s, '2026-10')
    expect(v.summary).toEqual({
      leftOver: 0,
      assigned: 0,
      activity: 0,
      available: 0,
      assignedInFuture: 0,
    })
    expect(v.readyToAssign).toBe(1_000_000)
  })
})

describe('documented (R1b, R1c)', () => {
  test('future assignments reduce Ready to Assign only from that month on', () => {
    const s = snap({
      ...g4Snapshot(),
      assignments: [
        assign('groc', '2026-10', 300_000),
        assign('dine', '2026-10', 100_000),
        assign('dine', '2026-11', 100_000),
      ],
    })
    const oct = computeMonth(s, '2026-10')
    expect(oct.readyToAssign).toBe(600_000)
    expect(oct.summary.assignedInFuture).toBe(100_000)

    const nov = computeMonth(s, '2026-11')
    expect(nov.readyToAssign).toBe(550_000 - 100_000)
  })

  test('income dated in a later month counts from that month on', () => {
    const s = snap({
      ...g4Snapshot(),
      transactions: [
        inflow('s', 'wallet', '2026-10-05', 1_000_000),
        spend('sp1', 'wallet', '2026-10-10', 'groc', 350_000),
        spend('sp2', 'cardA', '2026-10-12', 'dine', 120_000),
        inflow('nov', 'wallet', '2026-11-10', 500_000),
      ],
    })
    const oct = computeMonth(s, '2026-10')
    expect(oct.readyToAssign).toBe(600_000)
    const nov = computeMonth(s, '2026-11')
    expect(nov.readyToAssign).toBe(550_000 + 500_000)
  })
})
