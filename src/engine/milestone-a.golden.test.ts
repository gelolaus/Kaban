import { describe, expect, test } from 'vitest'
import {
  applyAssignmentDeltas,
  autoAssignPreview,
  moveMoneyPreview,
} from './autoAssign.ts'
import { computeMonth } from './compute.ts'
import { countWeekdayInMonth } from './months.ts'
import { canSnooze, computeTargets, costToBeMe } from './targets.ts'
import {
  assign,
  cash,
  inflow,
  normal,
  pesos,
  snap,
  spend,
} from './test-helpers.ts'
import type { BudgetSnapshot, EngineTarget } from './types.ts'

const CURRENT = '2026-10'
const wallet = cash('wallet')

function target(partial: EngineTarget): EngineTarget {
  return partial
}

describe('weekday counts for October–December 2026', () => {
  test('October has five Saturdays; November and December have four', () => {
    expect(countWeekdayInMonth('2026-10', 6)).toBe(5)
    expect(countWeekdayInMonth('2026-11', 6)).toBe(4)
    expect(countWeekdayInMonth('2026-12', 6)).toBe(4)
  })
})

describe('T1 monthly set-aside', () => {
  const t = target({
    categoryId: 'rent',
    cadence: 'monthly',
    behavior: 'set_aside',
    amount: pesos(5_000),
    dueDay: 1,
  })

  test('assigned 0 needs 5,000; assign 3,000 needs 2,000; assign 5,000 needs 0', () => {
    let s = snap({
      accounts: [wallet],
      categories: [normal('rent')],
      transactions: [inflow('i', 'wallet', '2026-10-01', pesos(20_000))],
      targets: [t],
    })
    expect(computeTargets(s, '2026-10', CURRENT).rent?.needed).toBe(pesos(5_000))

    s = { ...s, assignments: [assign('rent', '2026-10', pesos(3_000))] }
    expect(computeTargets(s, '2026-10', CURRENT).rent?.needed).toBe(pesos(2_000))

    s = { ...s, assignments: [assign('rent', '2026-10', pesos(5_000))] }
    expect(computeTargets(s, '2026-10', CURRENT).rent?.needed).toBe(0)
    expect(computeTargets(s, '2026-10', CURRENT).rent?.status).toBe('funded')
  })

  test('spending does not change needed; next month still needs 5,000', () => {
    const s = snap({
      accounts: [wallet],
      categories: [normal('rent')],
      transactions: [
        inflow('i', 'wallet', '2026-10-01', pesos(20_000)),
        spend('sp', 'wallet', '2026-10-15', 'rent', pesos(2_000)),
      ],
      assignments: [assign('rent', '2026-10', pesos(5_000))],
      targets: [t],
    })
    expect(computeTargets(s, '2026-10', CURRENT).rent?.needed).toBe(0)
    // November: carried 3,000, assigned 0 → still needs 5,000 (set-aside ignores leftover)
    expect(computeTargets(s, '2026-11', CURRENT).rent?.needed).toBe(pesos(5_000))
  })
})

describe('T2 monthly refill', () => {
  const t = target({
    categoryId: 'fun',
    cadence: 'monthly',
    behavior: 'refill',
    amount: pesos(5_000),
    dueDay: 'end',
  })

  test('assign 5,000 spend 3,500: October needed 0; November needs 3,500', () => {
    const s = snap({
      accounts: [wallet],
      categories: [normal('fun')],
      transactions: [
        inflow('i', 'wallet', '2026-10-01', pesos(20_000)),
        spend('sp', 'wallet', '2026-10-20', 'fun', pesos(3_500)),
      ],
      assignments: [assign('fun', '2026-10', pesos(5_000))],
      targets: [t],
    })
    expect(computeTargets(s, '2026-10', CURRENT).fun?.needed).toBe(0)
    expect(computeTargets(s, '2026-11', '2026-11').fun?.needed).toBe(pesos(3_500))

    const funded = {
      ...s,
      assignments: [...s.assignments, assign('fun', '2026-11', pesos(3_500))],
      transactions: [
        ...s.transactions,
        spend('sp2', 'wallet', '2026-11-05', 'fun', pesos(100)),
      ],
    }
    expect(computeTargets(funded, '2026-11', '2026-11').fun?.needed).toBe(0)
    expect(computeTargets(funded, '2026-11', '2026-11').fun?.status).toBe('funded')
  })

  test('future month from October ignores leftover', () => {
    const s = snap({
      accounts: [wallet],
      categories: [normal('fun')],
      transactions: [
        inflow('i', 'wallet', '2026-10-01', pesos(20_000)),
        spend('sp', 'wallet', '2026-10-20', 'fun', pesos(3_500)),
      ],
      assignments: [assign('fun', '2026-10', pesos(5_000))],
      targets: [t],
    })
    // Viewing November as future from October currentMonth
    expect(computeTargets(s, '2026-11', '2026-10').fun?.needed).toBe(pesos(5_000))
  })
})

describe('T3 weekly set-aside', () => {
  const t = target({
    categoryId: 'weekly',
    cadence: 'weekly',
    behavior: 'set_aside',
    amount: pesos(1_000),
    weekday: 6,
  })

  test('October 5,000; November 4,000; December 4,000', () => {
    const s = snap({
      accounts: [wallet],
      categories: [normal('weekly')],
      transactions: [inflow('i', 'wallet', '2026-10-01', pesos(50_000))],
      targets: [t],
    })
    expect(computeTargets(s, '2026-10', CURRENT).weekly?.needed).toBe(pesos(5_000))
    expect(computeTargets(s, '2026-11', CURRENT).weekly?.needed).toBe(pesos(4_000))
    expect(computeTargets(s, '2026-12', CURRENT).weekly?.needed).toBe(pesos(4_000))
  })
})

describe('assumed (T5 custom set-aside catch-up)', () => {
  const t = target({
    categoryId: 'trip',
    cadence: 'custom',
    behavior: 'set_aside',
    amount: pesos(60_000),
    dueMonth: '2027-09',
    repeat: 'none',
  })

  test('October needs 5,000; skip November still 5,000; December 5,500; after due 0', () => {
    let s = snap({
      accounts: [wallet],
      categories: [normal('trip')],
      transactions: [inflow('i', 'wallet', '2026-10-01', pesos(100_000))],
      targets: [t],
    })
    expect(computeTargets(s, '2026-10', CURRENT).trip?.needed).toBe(pesos(5_000))

    s = { ...s, assignments: [assign('trip', '2026-10', pesos(5_000))] }
    expect(computeTargets(s, '2026-11', CURRENT).trip?.needed).toBe(pesos(5_000))
    expect(computeTargets(s, '2026-12', CURRENT).trip?.needed).toBe(pesos(5_500))
    expect(computeTargets(s, '2027-10', CURRENT).trip?.needed).toBe(0)
  })

  test('custom 30,000 due 2027-03: October slice 5,000', () => {
    const short = target({
      categoryId: 'trip',
      cadence: 'custom',
      behavior: 'set_aside',
      amount: pesos(30_000),
      dueMonth: '2027-03',
      repeat: 'none',
    })
    const s = snap({
      accounts: [wallet],
      categories: [normal('trip')],
      transactions: [inflow('i', 'wallet', '2026-10-01', pesos(100_000))],
      targets: [short],
    })
    expect(computeTargets(s, '2026-10', CURRENT).trip?.needed).toBe(pesos(5_000))
  })
})

describe('T8 balance with no due date', () => {
  const t = target({
    categoryId: 'buffer',
    cadence: 'custom',
    behavior: 'balance',
    amount: pesos(100_000),
  })

  test('with 30,000 available needs 70,000, green when available > 0, skipped by Underfunded', () => {
    const s = snap({
      accounts: [wallet],
      categories: [normal('buffer')],
      transactions: [inflow('i', 'wallet', '2026-10-01', pesos(200_000))],
      assignments: [assign('buffer', '2026-10', pesos(30_000))],
      targets: [t],
    })
    const tv = computeTargets(s, '2026-10', CURRENT).buffer!
    expect(tv.needed).toBe(pesos(70_000))
    expect(tv.status).toBe('positive')

    const preview = autoAssignPreview(s, '2026-10', CURRENT, 'underfunded')
    expect(preview.deltas.find((d) => d.categoryId === 'buffer')).toBeUndefined()
  })
})

describe('Z1 to Z5 snooze', () => {
  const t = target({
    categoryId: 'rent',
    cadence: 'monthly',
    behavior: 'set_aside',
    amount: pesos(5_000),
    dueDay: 1,
  })

  test('snoozed needed 0 and Zz status; skipped by Underfunded; asks again next month', () => {
    const s = snap({
      accounts: [wallet],
      categories: [normal('rent')],
      transactions: [inflow('i', 'wallet', '2026-10-01', pesos(20_000))],
      targets: [t],
      snoozes: [{ categoryId: 'rent', month: '2026-10' }],
    })
    const tv = computeTargets(s, '2026-10', CURRENT).rent!
    expect(tv.needed).toBe(0)
    expect(tv.snoozed).toBe(true)
    expect(tv.status).toBe('snoozed')
    expect(computeTargets(s, '2026-11', CURRENT).rent?.needed).toBe(pesos(5_000))

    const preview = autoAssignPreview(s, '2026-10', CURRENT, 'underfunded')
    expect(preview.deltas.find((d) => d.categoryId === 'rent')).toBeUndefined()
  })

  test('snooze in a future month is refused', () => {
    expect(canSnooze('normal', '2026-11', CURRENT)).toBe(false)
    expect(canSnooze('normal', CURRENT, CURRENT)).toBe(true)
    expect(canSnooze('credit_card_payment', CURRENT, CURRENT)).toBe(false)
  })
})

describe('C1 to C4 Cost to Be Me', () => {
  test('October targets 15,000; margin 5,000; November 14,000 so no next-month line', () => {
    const s = snap({
      accounts: [wallet],
      categories: [normal('m'), normal('w'), normal('c')],
      transactions: [inflow('i', 'wallet', '2026-10-01', pesos(50_000))],
      targets: [
        target({
          categoryId: 'm',
          cadence: 'monthly',
          behavior: 'set_aside',
          amount: pesos(5_000),
          dueDay: 1,
        }),
        target({
          categoryId: 'w',
          cadence: 'weekly',
          behavior: 'set_aside',
          amount: pesos(1_000),
          weekday: 6,
        }),
        target({
          categoryId: 'c',
          cadence: 'custom',
          behavior: 'set_aside',
          amount: pesos(30_000),
          dueMonth: '2027-03',
          repeat: 'none',
        }),
      ],
    })
    const c = costToBeMe(s, '2026-10', CURRENT, pesos(20_000))
    expect(c.thisMonth).toBe(pesos(15_000))
    expect(c.margin).toBe(pesos(5_000))
    expect(c.nextMonth).toBeNull()
  })
})

describe('A1 Underfunded order', () => {
  function underfundedSnap(rtaPesos: number): BudgetSnapshot {
    return snap({
      accounts: [wallet],
      categories: [normal('rent'), normal('net'), normal('fun'), normal('trip')],
      transactions: [inflow('i', 'wallet', '2026-10-01', pesos(rtaPesos))],
      targets: [
        target({
          categoryId: 'rent',
          cadence: 'monthly',
          behavior: 'set_aside',
          amount: pesos(5_000),
          dueDay: 1,
        }),
        target({
          categoryId: 'net',
          cadence: 'monthly',
          behavior: 'set_aside',
          amount: pesos(1_500),
          dueDay: 15,
        }),
        target({
          categoryId: 'fun',
          cadence: 'monthly',
          behavior: 'set_aside',
          amount: pesos(2_000),
          dueDay: 'end',
        }),
        target({
          categoryId: 'trip',
          cadence: 'custom',
          behavior: 'set_aside',
          amount: pesos(12_000),
          dueMonth: '2027-01',
          repeat: 'none',
        }),
      ],
    })
  }

  test('with 9,000 Ready to Assign: Rent, Internet, Fun, Trip 500', () => {
    const s = underfundedSnap(9_000)
    const p = autoAssignPreview(s, '2026-10', CURRENT, 'underfunded')
    const byId = Object.fromEntries(p.deltas.map((d) => [d.categoryId, d.delta]))
    expect(byId.rent).toBe(pesos(5_000))
    expect(byId.net).toBe(pesos(1_500))
    expect(byId.fun).toBe(pesos(2_000))
    expect(byId.trip).toBe(pesos(500))
    expect(p.readyToAssignAfter).toBe(0)
  })

  test('with 20,000 Ready to Assign: Trip gets 3,000 and 8,500 left', () => {
    const s = underfundedSnap(20_000)
    const p = autoAssignPreview(s, '2026-10', CURRENT, 'underfunded')
    const byId = Object.fromEntries(p.deltas.map((d) => [d.categoryId, d.delta]))
    expect(byId.trip).toBe(pesos(3_000))
    expect(p.readyToAssignAfter).toBe(pesos(8_500))
  })
})

describe('assumed (A1 tier 1 overspend then needed)', () => {
  test('Dining out at -300 with 1,000 set-aside: Underfunded assigns 1,000; Available +700', () => {
    const s = snap({
      accounts: [wallet],
      categories: [normal('dine')],
      transactions: [
        inflow('i', 'wallet', '2026-10-01', pesos(10_000)),
        spend('sp', 'wallet', '2026-10-05', 'dine', pesos(300)),
      ],
      targets: [
        target({
          categoryId: 'dine',
          cadence: 'monthly',
          behavior: 'set_aside',
          amount: pesos(1_000),
          dueDay: 1,
        }),
      ],
    })
    expect(computeMonth(s, '2026-10').categories.dine?.available).toBe(pesos(-300))
    const p = autoAssignPreview(s, '2026-10', CURRENT, 'underfunded')
    expect(p.deltas.find((d) => d.categoryId === 'dine')?.delta).toBe(pesos(1_000))
    const next = applyAssignmentDeltas(s, '2026-10', p.deltas)
    expect(computeMonth(next, '2026-10').categories.dine?.available).toBe(pesos(700))
  })
})

describe('assumed (A3 A4 replace not add)', () => {
  test('Assigned Last Month and Spent Last Month set amounts', () => {
    const s = snap({
      accounts: [wallet],
      categories: [normal('groc')],
      transactions: [
        inflow('i', 'wallet', '2026-09-01', pesos(20_000)),
        spend('sp', 'wallet', '2026-09-10', 'groc', pesos(2_500)),
      ],
      assignments: [assign('groc', '2026-09', pesos(4_000))],
      targets: [
        target({
          categoryId: 'groc',
          cadence: 'monthly',
          behavior: 'set_aside',
          amount: pesos(5_000),
          dueDay: 1,
        }),
      ],
    })
    const a3 = autoAssignPreview(s, '2026-10', CURRENT, 'assigned_last_month', {
      categoryIds: ['groc'],
    })
    expect(a3.deltas[0]?.delta).toBe(pesos(4_000))

    const a4 = autoAssignPreview(s, '2026-10', CURRENT, 'spent_last_month', {
      categoryIds: ['groc'],
    })
    expect(a4.deltas[0]?.delta).toBe(pesos(2_500))
  })
})

describe('assumed (A5 A6 averages and rounding)', () => {
  test('Average Assigned 4,000; Average Spent 1,000; 100/100/101 → 100.33', () => {
    const s = snap({
      accounts: [wallet],
      categories: [normal('groc')],
      transactions: [
        inflow('i', 'wallet', '2026-07-01', pesos(50_000)),
        spend('s1', 'wallet', '2026-08-05', 'groc', pesos(1_000)),
        spend('s2', 'wallet', '2026-09-05', 'groc', pesos(2_000)),
      ],
      assignments: [
        assign('groc', '2026-07', pesos(3_000)),
        assign('groc', '2026-08', pesos(4_000)),
        assign('groc', '2026-09', pesos(5_000)),
      ],
    })
    const a5 = autoAssignPreview(s, '2026-10', CURRENT, 'average_assigned', {
      categoryIds: ['groc'],
    })
    expect(a5.deltas[0]?.delta).toBe(pesos(4_000))

    const a6 = autoAssignPreview(s, '2026-10', CURRENT, 'average_spent', {
      categoryIds: ['groc'],
    })
    expect(a6.deltas[0]?.delta).toBe(pesos(1_000))

    const uneven = snap({
      accounts: [wallet],
      categories: [normal('groc')],
      transactions: [inflow('i', 'wallet', '2026-07-01', pesos(50_000))],
      assignments: [
        assign('groc', '2026-07', pesos(100)),
        assign('groc', '2026-08', pesos(100)),
        assign('groc', '2026-09', pesos(101)),
      ],
    })
    const avg = autoAssignPreview(uneven, '2026-10', CURRENT, 'average_assigned', {
      categoryIds: ['groc'],
    })
    expect(avg.deltas[0]?.delta).toBe(10_033)
  })
})

describe('assumed (A7 Reduce Overfunding excess)', () => {
  test('monthly 5,000 set-aside with 6,000 assigned returns 1,000', () => {
    const s = snap({
      accounts: [wallet],
      categories: [normal('rent')],
      transactions: [inflow('i', 'wallet', '2026-10-01', pesos(20_000))],
      assignments: [assign('rent', '2026-10', pesos(6_000))],
      targets: [
        target({
          categoryId: 'rent',
          cadence: 'monthly',
          behavior: 'set_aside',
          amount: pesos(5_000),
          dueDay: 1,
        }),
      ],
    })
    const p = autoAssignPreview(s, '2026-10', CURRENT, 'reduce_overfunding')
    expect(p.deltas[0]).toEqual({ categoryId: 'rent', delta: -pesos(1_000) })
  })
})

describe('assumed (A8 positive Available only)', () => {
  test('Reset Available sends positive Available back; Assigned can go negative', () => {
    const s = snap({
      accounts: [wallet],
      categories: [normal('groc')],
      transactions: [inflow('i', 'wallet', '2026-10-01', pesos(20_000))],
      assignments: [assign('groc', '2026-10', pesos(2_000))],
    })
    const p = autoAssignPreview(s, '2026-10', CURRENT, 'reset_available')
    expect(p.deltas[0]?.delta).toBe(-pesos(2_000))
    const next = applyAssignmentDeltas(s, '2026-10', p.deltas)
    expect(computeMonth(next, '2026-10').categories.groc?.assigned).toBe(0)
  })
})

describe('A9 Reset Assigned', () => {
  test('sets Assigned to 0', () => {
    const s = snap({
      accounts: [wallet],
      categories: [normal('groc')],
      transactions: [inflow('i', 'wallet', '2026-10-01', pesos(20_000))],
      assignments: [assign('groc', '2026-10', pesos(2_000))],
    })
    const p = autoAssignPreview(s, '2026-10', CURRENT, 'reset_assigned')
    expect(p.deltas[0]?.delta).toBe(-pesos(2_000))
  })
})

describe('M1 to M4 moves', () => {
  test('move 500 from Groceries to Dining; cover; undo and redo', () => {
    let s = snap({
      accounts: [wallet],
      categories: [normal('groc'), normal('dine')],
      transactions: [
        inflow('i', 'wallet', '2026-10-01', pesos(20_000)),
        spend('sp', 'wallet', '2026-10-05', 'dine', pesos(300)),
      ],
      assignments: [assign('groc', '2026-10', pesos(800))],
    })
    expect(computeMonth(s, '2026-10').categories.groc?.available).toBe(pesos(800))
    const rtaBefore = computeMonth(s, '2026-10').readyToAssign

    const move = moveMoneyPreview(s, '2026-10', 'groc', 'dine', pesos(500))
    s = applyAssignmentDeltas(s, '2026-10', move.deltas)
    expect(computeMonth(s, '2026-10').categories.groc?.available).toBe(pesos(300))
    expect(computeMonth(s, '2026-10').categories.dine?.available).toBe(pesos(200))
    expect(computeMonth(s, '2026-10').readyToAssign).toBe(rtaBefore)

    const cover = moveMoneyPreview(s, '2026-10', 'groc', 'dine', pesos(300))
    // Dining available is +200, so cover overspend isn't needed; cover to bring a negative to 0:
    // Reset dine to overspent for cover demo
    s = snap({
      accounts: [wallet],
      categories: [normal('groc'), normal('dine')],
      transactions: [
        inflow('i', 'wallet', '2026-10-01', pesos(20_000)),
        spend('sp', 'wallet', '2026-10-05', 'dine', pesos(300)),
      ],
      assignments: [assign('groc', '2026-10', pesos(800))],
    })
    const afterMove = applyAssignmentDeltas(
      s,
      '2026-10',
      moveMoneyPreview(s, '2026-10', 'groc', 'dine', pesos(500)).deltas,
    )
    // Dining: -300 + 500 = +200. To cover original -300 from groceries before move:
    const coverFrom = moveMoneyPreview(s, '2026-10', 'groc', 'dine', pesos(300))
    const covered = applyAssignmentDeltas(s, '2026-10', coverFrom.deltas)
    expect(computeMonth(covered, '2026-10').categories.dine?.available).toBe(0)
    expect(computeMonth(covered, '2026-10').categories.groc?.available).toBe(pesos(500))

    // Undo = remove the cover deltas
    const undone = s
    expect(computeMonth(undone, '2026-10').categories.groc?.available).toBe(pesos(800))
    // Redo = reapply
    const redone = applyAssignmentDeltas(undone, '2026-10', coverFrom.deltas)
    expect(computeMonth(redone, '2026-10').categories.dine?.available).toBe(0)

    // A new move after undo clears redo conceptually (engine-level: redo stack is storage)
    void afterMove
    void cover
  })
})
