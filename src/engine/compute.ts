import {
  compareMonths,
  isMonthKey,
  monthOfDate,
  monthRange,
  type MonthKey,
} from './months.ts'
import type {
  AssignmentEntry,
  BudgetSnapshot,
  CategoryMonth,
  EngineAccount,
  EngineTransaction,
  EngineWarning,
  MonthSummary,
  MonthView,
} from './types.ts'

function assertSafeMoney(amount: number, recordId: string): void {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`unsafe money amount on record ${recordId}: ${amount}`)
  }
}

function validateSnapshotAmounts(snapshot: BudgetSnapshot): void {
  for (const tx of snapshot.transactions) {
    assertSafeMoney(tx.amount, tx.id)
  }
  for (const a of snapshot.assignments) {
    assertSafeMoney(a.delta, `${a.categoryId}:${a.month}`)
  }
}

function emptyCategory(categoryId: string): CategoryMonth {
  return {
    categoryId,
    carried: 0,
    assigned: 0,
    cashActivity: 0,
    creditActivity: 0,
    activity: 0,
    available: 0,
    cashOverspending: 0,
    creditOverspending: 0,
  }
}

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  const map = new Map<string, T>()
  for (const item of items) map.set(item.id, item)
  return map
}

function findEarliestMonth(snapshot: BudgetSnapshot): MonthKey | null {
  let earliest: MonthKey | null = null
  const consider = (m: MonthKey | null) => {
    if (!m) return
    if (earliest === null || compareMonths(m, earliest) < 0) earliest = m
  }
  for (const tx of snapshot.transactions) {
    consider(monthOfDate(tx.date))
  }
  for (const a of snapshot.assignments) {
    if (isMonthKey(a.month)) consider(a.month)
  }
  return earliest
}

function sumAssignedInFuture(
  assignments: AssignmentEntry[],
  month: MonthKey,
  categoryIds: Set<string>,
): number {
  let total = 0
  for (const a of assignments) {
    if (!categoryIds.has(a.categoryId)) continue
    if (!isMonthKey(a.month)) continue
    if (compareMonths(a.month, month) > 0) total += a.delta
  }
  return total
}

function summarize(
  categories: Record<string, CategoryMonth>,
  assignedInFuture: number,
): MonthSummary {
  let leftOver = 0
  let assigned = 0
  let activity = 0
  let available = 0
  for (const c of Object.values(categories)) {
    leftOver += c.carried
    assigned += c.assigned
    activity += c.activity
    available += c.available
  }
  return { leftOver, assigned, activity, available, assignedInFuture }
}

export function accountBalances(
  snapshot: BudgetSnapshot,
  throughDate?: string,
): Record<string, number> {
  validateSnapshotAmounts(snapshot)
  const accounts = indexById(snapshot.accounts)
  const balances: Record<string, number> = {}
  for (const a of snapshot.accounts) balances[a.id] = 0

  for (const tx of snapshot.transactions) {
    if (throughDate !== undefined && tx.date > throughDate) continue
    if (monthOfDate(tx.date) === null) continue

    switch (tx.kind) {
      case 'inflow':
      case 'categorized':
      case 'uncategorized': {
        if (!accounts.has(tx.accountId)) continue
        balances[tx.accountId] = (balances[tx.accountId] ?? 0) + tx.amount
        break
      }
      case 'transfer': {
        if (accounts.has(tx.accountId)) {
          balances[tx.accountId] = (balances[tx.accountId] ?? 0) - tx.amount
        }
        if (accounts.has(tx.toAccountId)) {
          balances[tx.toAccountId] = (balances[tx.toAccountId] ?? 0) + tx.amount
        }
        break
      }
    }
  }
  return balances
}

export function computeMonth(snapshot: BudgetSnapshot, month: MonthKey): MonthView {
  if (!isMonthKey(month)) {
    throw new RangeError(`invalid MonthKey: ${month}`)
  }
  validateSnapshotAmounts(snapshot)

  const accounts = indexById(snapshot.accounts)
  const categories = indexById(snapshot.categories)
  const categoryIds = new Set(categories.keys())
  const warnings: EngineWarning[] = []
  const warnOnce = new Set<string>()

  const pushWarning = (w: EngineWarning) => {
    const key = `${w.code}:${w.transactionId}`
    if (warnOnce.has(key)) return
    warnOnce.add(key)
    warnings.push(w)
  }

  type CatTx = {
    tx: Extract<EngineTransaction, { kind: 'categorized' }>
    account: EngineAccount
  }
  const categorizedByMonth = new Map<MonthKey, CatTx[]>()
  const inflowsByMonth = new Map<MonthKey, number>()
  const assignmentsByMonth = new Map<MonthKey, AssignmentEntry[]>()

  for (const a of snapshot.assignments) {
    if (!isMonthKey(a.month)) continue
    const list = assignmentsByMonth.get(a.month) ?? []
    list.push(a)
    assignmentsByMonth.set(a.month, list)
  }

  for (const tx of snapshot.transactions) {
    const m = monthOfDate(tx.date)
    if (m === null) {
      pushWarning({
        code: 'invalid_date',
        transactionId: tx.id,
        message: `invalid date ${tx.date}`,
      })
      continue
    }

    if (tx.kind === 'inflow') {
      if (!accounts.has(tx.accountId)) {
        pushWarning({
          code: 'unknown_account',
          transactionId: tx.id,
          message: `unknown account ${tx.accountId}`,
        })
        continue
      }
      inflowsByMonth.set(m, (inflowsByMonth.get(m) ?? 0) + tx.amount)
      continue
    }

    if (tx.kind === 'categorized') {
      const account = accounts.get(tx.accountId)
      if (!account) {
        pushWarning({
          code: 'unknown_account',
          transactionId: tx.id,
          message: `unknown account ${tx.accountId}`,
        })
        continue
      }
      if (!categories.has(tx.categoryId)) {
        pushWarning({
          code: 'unknown_category',
          transactionId: tx.id,
          message: `unknown category ${tx.categoryId}`,
        })
        continue
      }
      const list = categorizedByMonth.get(m) ?? []
      list.push({ tx, account })
      categorizedByMonth.set(m, list)
      continue
    }

    if (tx.kind === 'transfer') {
      if (!accounts.has(tx.accountId) || !accounts.has(tx.toAccountId)) {
        pushWarning({
          code: 'unknown_account',
          transactionId: tx.id,
          message: `unknown account on transfer ${tx.id}`,
        })
      }
      continue
    }

    if (tx.kind === 'uncategorized') {
      if (!accounts.has(tx.accountId)) {
        pushWarning({
          code: 'unknown_account',
          transactionId: tx.id,
          message: `unknown account ${tx.accountId}`,
        })
      }
    }
  }

  const earliest = findEarliestMonth(snapshot)
  const assignedInFuture = sumAssignedInFuture(snapshot.assignments, month, categoryIds)

  const blankCategories = (): Record<string, CategoryMonth> => {
    const out: Record<string, CategoryMonth> = {}
    for (const id of categoryIds) out[id] = emptyCategory(id)
    return out
  }

  if (earliest === null || compareMonths(month, earliest) < 0) {
    const cats = blankCategories()
    return {
      month,
      readyToAssign: 0,
      categories: cats,
      summary: summarize(cats, assignedInFuture),
      warnings,
    }
  }

  let readyToAssign = 0
  let prevCategories: Record<string, CategoryMonth> = blankCategories()
  let result: MonthView | null = null

  for (const m of monthRange(earliest, month)) {
    const cats: Record<string, CategoryMonth> = {}
    let assignedThisMonth = 0
    let cashOverspendPrev = 0
    for (const prev of Object.values(prevCategories)) {
      cashOverspendPrev += prev.cashOverspending
    }

    for (const cat of snapshot.categories) {
      const prev = prevCategories[cat.id] ?? emptyCategory(cat.id)
      const carried = Math.max(0, prev.available)
      let assigned = 0
      for (const a of assignmentsByMonth.get(m) ?? []) {
        if (a.categoryId === cat.id) assigned += a.delta
      }
      assignedThisMonth += assigned

      let cashActivity = 0
      let creditActivity = 0
      for (const { tx, account } of categorizedByMonth.get(m) ?? []) {
        if (tx.categoryId !== cat.id) continue
        if (account.kind === 'cash') cashActivity += tx.amount
        else creditActivity += tx.amount
      }

      const activity = cashActivity + creditActivity
      const available = carried + assigned + activity

      cats[cat.id] = {
        categoryId: cat.id,
        carried,
        assigned,
        cashActivity,
        creditActivity,
        activity,
        available,
        cashOverspending: 0,
        creditOverspending: 0,
      }
    }

    const inflows = inflowsByMonth.get(m) ?? 0
    readyToAssign = readyToAssign + inflows - assignedThisMonth - cashOverspendPrev

    const view: MonthView = {
      month: m,
      readyToAssign,
      categories: cats,
      summary: summarize(cats, m === month ? assignedInFuture : 0),
      warnings: m === month ? warnings : [],
    }
    prevCategories = cats
    if (m === month) result = view
  }

  return (
    result ?? {
      month,
      readyToAssign: 0,
      categories: blankCategories(),
      summary: summarize(blankCategories(), assignedInFuture),
      warnings,
    }
  )
}
