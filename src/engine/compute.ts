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
  EngineCategory,
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

function indexById<T extends { id: string }>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>()
  for (const row of rows) map.set(row.id, row)
  return map
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

function summarize(categories: Record<string, CategoryMonth>, assignedInFuture: number): MonthSummary {
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

type CatTx = {
  tx: Extract<EngineTransaction, { kind: 'categorized' }>
  account: EngineAccount
}

export function computeMonth(snapshot: BudgetSnapshot, month: MonthKey): MonthView {
  if (!isMonthKey(month)) {
    throw new RangeError(`invalid MonthKey: ${month}`)
  }
  validateSnapshotAmounts(snapshot)

  const accounts = indexById(snapshot.accounts)
  const categories = indexById(snapshot.categories)
  const categoryIds = new Set(categories.keys())
  const paymentByCard = new Map<string, string>()
  for (const c of snapshot.categories) {
    if (c.kind === 'credit_card_payment' && c.cardAccountId) {
      paymentByCard.set(c.cardAccountId, c.id)
    }
  }

  const warnings: EngineWarning[] = []
  const warnOnce = new Set<string>()
  const pushWarning = (w: EngineWarning) => {
    const key = `${w.code}:${w.transactionId}`
    if (warnOnce.has(key)) return
    warnOnce.add(key)
    warnings.push(w)
  }

  const categorizedByMonth = new Map<MonthKey, CatTx[]>()
  const inflowsByMonth = new Map<MonthKey, number>()
  const assignmentsByMonth = new Map<MonthKey, AssignmentEntry[]>()
  const paymentsByMonth = new Map<MonthKey, Extract<EngineTransaction, { kind: 'transfer' }>[]>()

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
      // Credit refunds (positive amount on credit account) are unsupported for budget math
      if (account.kind === 'credit' && tx.amount > 0) {
        pushWarning({
          code: 'unsupported',
          transactionId: tx.id,
          message: 'credit refunds are unsupported',
        })
        continue
      }
      const list = categorizedByMonth.get(m) ?? []
      list.push({ tx, account })
      categorizedByMonth.set(m, list)
      continue
    }

    if (tx.kind === 'transfer') {
      const from = accounts.get(tx.accountId)
      const to = accounts.get(tx.toAccountId)
      if (!from || !to) {
        pushWarning({
          code: 'unknown_account',
          transactionId: tx.id,
          message: `unknown account on transfer ${tx.id}`,
        })
        continue
      }
      if (from.kind === 'credit') {
        pushWarning({
          code: 'unsupported',
          transactionId: tx.id,
          message: 'transfers from a credit account are unsupported',
        })
        continue
      }
      if (from.kind === 'cash' && to.kind === 'credit') {
        const list = paymentsByMonth.get(m) ?? []
        list.push(tx)
        paymentsByMonth.set(m, list)
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

    // Payment category moved amounts from credit coverage
    const movedToPayment = new Map<string, number>()

    // First pass: normal categories
    for (const cat of snapshot.categories) {
      if (cat.kind === 'credit_card_payment') continue
      const built = buildNormalCategory(
        cat,
        prevCategories[cat.id] ?? emptyCategory(cat.id),
        assignmentsByMonth.get(m) ?? [],
        categorizedByMonth.get(m) ?? [],
        paymentByCard,
        pushWarning,
      )
      assignedThisMonth += built.assigned
      for (const [payId, amt] of built.moved) {
        movedToPayment.set(payId, (movedToPayment.get(payId) ?? 0) + amt)
      }
      cats[cat.id] = built.month
    }

    // Payment categories
    for (const cat of snapshot.categories) {
      if (cat.kind !== 'credit_card_payment') continue
      const prev = prevCategories[cat.id] ?? emptyCategory(cat.id)
      const carried = Math.max(0, prev.available)
      let assigned = 0
      for (const a of assignmentsByMonth.get(m) ?? []) {
        if (a.categoryId === cat.id) assigned += a.delta
      }
      assignedThisMonth += assigned

      const moved = movedToPayment.get(cat.id) ?? 0
      let paid = 0
      for (const tx of paymentsByMonth.get(m) ?? []) {
        if (cat.cardAccountId && tx.toAccountId === cat.cardAccountId) {
          paid += tx.amount
        }
      }
      const activity = moved - paid
      const available = carried + assigned + activity
      const cashSpend = Math.max(0, -activity)
      const fundsForSpend = carried + assigned + Math.max(0, activity)
      const cashOverspending = Math.max(0, cashSpend - fundsForSpend)

      cats[cat.id] = {
        categoryId: cat.id,
        carried,
        assigned,
        cashActivity: activity,
        creditActivity: 0,
        activity,
        available,
        cashOverspending,
        creditOverspending: 0,
      }
    }

    // Ensure every category id exists
    for (const id of categoryIds) {
      if (!cats[id]) cats[id] = emptyCategory(id)
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

function buildNormalCategory(
  cat: EngineCategory,
  prev: CategoryMonth,
  assignments: AssignmentEntry[],
  categorized: CatTx[],
  paymentByCard: Map<string, string>,
  pushWarning: (w: EngineWarning) => void,
): { month: CategoryMonth; assigned: number; moved: Map<string, number> } {
  const carried = Math.max(0, prev.available)
  let assigned = 0
  for (const a of assignments) {
    if (a.categoryId === cat.id) assigned += a.delta
  }

  let cashActivity = 0
  let creditActivity = 0
  const creditTxs: CatTx[] = []
  for (const item of categorized) {
    if (item.tx.categoryId !== cat.id) continue
    if (item.account.kind === 'cash') cashActivity += item.tx.amount
    else {
      creditActivity += item.tx.amount
      creditTxs.push(item)
    }
  }

  const fundsForSpend = carried + assigned + Math.max(0, cashActivity)
  const cashSpend = Math.max(0, -cashActivity)
  const cashOverspending = Math.max(0, cashSpend - fundsForSpend)
  const remainingAfterCash = Math.max(0, fundsForSpend - cashSpend)

  creditTxs.sort((a, b) => {
    if (a.tx.date !== b.tx.date) return a.tx.date < b.tx.date ? -1 : 1
    return a.tx.id < b.tx.id ? -1 : a.tx.id > b.tx.id ? 1 : 0
  })

  let remaining = remainingAfterCash
  let creditOverspending = 0
  const moved = new Map<string, number>()

  for (const item of creditTxs) {
    const spend = Math.max(0, -item.tx.amount)
    const covered = Math.min(spend, remaining)
    const uncovered = spend - covered
    remaining -= covered
    creditOverspending += uncovered
    if (covered > 0) {
      const payId = paymentByCard.get(item.account.id)
      if (!payId) {
        pushWarning({
          code: 'unknown_category',
          transactionId: item.tx.id,
          message: `no payment category for card ${item.account.id}`,
        })
      } else {
        moved.set(payId, (moved.get(payId) ?? 0) + covered)
      }
    }
  }

  const activity = cashActivity + creditActivity
  const available = carried + assigned + activity

  return {
    assigned,
    moved,
    month: {
      categoryId: cat.id,
      carried,
      assigned,
      cashActivity,
      creditActivity,
      activity,
      available,
      cashOverspending,
      creditOverspending,
    },
  }
}
