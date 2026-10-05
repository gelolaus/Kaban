import { expect, test } from 'vitest'
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
import type { BudgetSnapshot } from './types.ts'
import { monthRange } from './months.ts'

function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]!
}

function buildRandom(seed: number): BudgetSnapshot {
  const rand = lcg(seed)
  const accounts = [cash('c1'), cash('c2'), card('k1'), card('k2')]
  const categories = [
    normal('n1'),
    normal('n2'),
    normal('n3'),
    normal('n4'),
    normal('n5'),
    payment('p1', 'k1'),
    payment('p2', 'k2'),
  ]
  const months = monthRange('2026-08', '2027-01')
  const transactions = []
  const assignments = []
  for (let i = 0; i < 30; i++) {
    const month = pick(rand, months)
    const day = String(1 + Math.floor(rand() * 28)).padStart(2, '0')
    const date = `${month}-${day}`
    const roll = rand()
    if (roll < 0.15) {
      transactions.push(inflow(`i${i}`, pick(rand, ['c1', 'c2']), date, 10_000 + Math.floor(rand() * 200_000)))
    } else if (roll < 0.4) {
      transactions.push(
        spend(`s${i}`, pick(rand, ['c1', 'c2']), date, pick(rand, ['n1', 'n2', 'n3', 'n4', 'n5']), 1_000 + Math.floor(rand() * 50_000)),
      )
    } else if (roll < 0.6) {
      transactions.push(
        spend(`k${i}`, pick(rand, ['k1', 'k2']), date, pick(rand, ['n1', 'n2', 'n3', 'n4', 'n5']), 1_000 + Math.floor(rand() * 50_000)),
      )
    } else if (roll < 0.7) {
      transactions.push(
        refund(`r${i}`, pick(rand, ['c1', 'c2']), date, pick(rand, ['n1', 'n2', 'n3', 'n4', 'n5']), 1_000 + Math.floor(rand() * 20_000)),
      )
    } else if (roll < 0.85) {
      transactions.push(pay(`p${i}`, pick(rand, ['c1', 'c2']), pick(rand, ['k1', 'k2']), date, 1_000 + Math.floor(rand() * 40_000)))
    } else if (roll < 0.92) {
      transactions.push(pay(`t${i}`, 'c1', 'c2', date, 1_000 + Math.floor(rand() * 10_000)))
    } else {
      transactions.push(plain(`u${i}`, pick(rand, ['k1', 'k2']), date, -1_000 - Math.floor(rand() * 30_000)))
    }
  }
  for (let i = 0; i < 15; i++) {
    assignments.push(
      assign(pick(rand, ['n1', 'n2', 'n3', 'n4', 'n5', 'p1', 'p2']), pick(rand, months), Math.floor(rand() * 80_000)),
    )
  }
  return snap({ accounts, categories, transactions, assignments })
}

function lastDay(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return `${month}-${String(days[m - 1]).padStart(2, '0')}`
}

test('cash identity across 200 seeds', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const full = buildRandom(seed)
    for (const m of monthRange('2026-08', '2027-01')) {
      const filtered = snap({
        accounts: full.accounts,
        categories: full.categories,
        transactions: full.transactions.filter((t) => t.date <= lastDay(m)),
        assignments: full.assignments.filter((a) => a.month <= m),
      })
      const view = computeMonth(filtered, m)
      const bals = accountBalances(filtered)
      const cashSum = filtered.accounts
        .filter((a) => a.kind === 'cash')
        .reduce((sum, a) => sum + (bals[a.id] ?? 0), 0)
      const availSum = Object.values(view.categories).reduce((s, c) => s + c.available, 0)
      const creditOver = Object.values(view.categories).reduce((s, c) => s + c.creditOverspending, 0)
      expect(cashSum, `seed ${seed} month ${m}`).toBe(view.readyToAssign + availSum + creditOver)

      for (const c of Object.values(view.categories)) {
        expect(c.available).toBe(c.carried + c.assigned + c.activity)
        expect(c.carried).toBeGreaterThanOrEqual(0)
        expect(c.cashOverspending).toBeGreaterThanOrEqual(0)
        expect(c.creditOverspending).toBeGreaterThanOrEqual(0)
        const cat = filtered.categories.find((x) => x.id === c.categoryId)
        if (cat?.kind === 'normal') {
          expect(c.activity).toBe(c.cashActivity + c.creditActivity)
        }
      }
    }
  }
})

test('input order does not matter', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const base = buildRandom(seed)
    const rand = lcg(seed + 999)
    const shuffle = <T>(arr: T[]): T[] => {
      const out = arr.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[out[i], out[j]] = [out[j]!, out[i]!]
      }
      return out
    }
    const shuffled = snap({
      accounts: shuffle(base.accounts),
      categories: shuffle(base.categories),
      transactions: shuffle(base.transactions),
      assignments: shuffle(base.assignments),
    })
    expect(computeMonth(shuffled, '2026-11')).toEqual(computeMonth(base, '2026-11'))
  }
})

test('computeMonth is pure', () => {
  const s = buildRandom(42)
  const frozen = structuredClone(s)
  Object.freeze(frozen.accounts)
  Object.freeze(frozen.categories)
  Object.freeze(frozen.transactions)
  Object.freeze(frozen.assignments)
  Object.freeze(frozen)
  const a = computeMonth(frozen, '2026-10')
  const b = computeMonth(frozen, '2026-10')
  expect(a).toEqual(b)
  expect(frozen).toEqual(s)
})

test('a large history stays fast', () => {
  const accounts = [cash('c1'), cash('c2'), card('k1'), card('k2')]
  const categories = [
    ...Array.from({ length: 38 }, (_, i) => normal(`n${i}`)),
    payment('p1', 'k1'),
    payment('p2', 'k2'),
  ]
  const months = monthRange('2021-01', '2025-12')
  const transactions = []
  const assignments = []
  const rand = lcg(7)
  for (let i = 0; i < 10_000; i++) {
    const month = pick(rand, months)
    const date = `${month}-15`
    if (rand() < 0.5) {
      transactions.push(spend(`s${i}`, 'c1', date, pick(rand, categories.filter((c) => c.kind === 'normal').map((c) => c.id)), 1000))
    } else {
      transactions.push(inflow(`i${i}`, 'c1', date, 5000))
    }
  }
  for (const m of months) {
    assignments.push(assign('n0', m, 1000))
  }
  const s = snap({ accounts, categories, transactions, assignments })
  const start = performance.now()
  computeMonth(s, '2025-12')
  const elapsed = performance.now() - start
  expect(elapsed, `large history took ${elapsed.toFixed(2)}ms`).toBeLessThan(500)
})
