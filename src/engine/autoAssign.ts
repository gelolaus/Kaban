import { computeMonth } from './compute.ts'
import { addMonths, type MonthKey } from './months.ts'
import { computeTargets, neededForTarget } from './targets.ts'
import type {
  AssignmentEntry,
  AutoAssignOption,
  AutoAssignPreview,
  BudgetSnapshot,
  EngineCategory,
  EngineTarget,
} from './types.ts'

export interface AutoAssignScope {
  /** When set, only these categories (A2 may drive Ready to Assign negative). */
  categoryIds?: string[]
}

function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.floor(Math.abs(n) + 0.5)
}

function meanNearestCentavo(values: number[]): number {
  if (values.length === 0) return 0
  const sum = values.reduce((a, b) => a + b, 0)
  return roundHalfUp(sum / values.length)
}

function assignedByCategoryMonth(
  assignments: AssignmentEntry[],
  categoryId: string,
  month: MonthKey,
): number {
  let total = 0
  for (const a of assignments) {
    if (a.categoryId === categoryId && a.month === month) total += a.delta
  }
  return total
}

function categoryOrder(snapshot: BudgetSnapshot): string[] {
  return snapshot.categories.map((c) => c.id)
}

function targetByCategory(snapshot: BudgetSnapshot): Map<string, EngineTarget> {
  const map = new Map<string, EngineTarget>()
  for (const t of snapshot.targets ?? []) map.set(t.categoryId, t)
  return map
}

function isBalanceNoDue(t: EngineTarget): boolean {
  return t.behavior === 'balance' && !t.dueMonth
}

function underfundedDueRank(t: EngineTarget, month: MonthKey): number {
  // Lower = earlier. Tier buckets:
  // 2a weekly / dated monthly: due day (end = 32)
  // 3 end of month monthly
  // 4 custom/yearly by due month distance
  if (t.cadence === 'weekly') return t.weekday ?? 0
  if (t.cadence === 'monthly') {
    if (t.dueDay === 'end' || t.dueDay === undefined) return 32
    return t.dueDay
  }
  if (t.dueMonth) {
    // After monthlies: encode months from now as 1000 + offset
    const offset = Math.max(0, monthRangeOffset(month, t.dueMonth))
    return 1000 + offset
  }
  return 9999
}

function monthRangeOffset(from: MonthKey, to: MonthKey): number {
  const fy = Number(from.slice(0, 4))
  const fm = Number(from.slice(5, 7))
  const ty = Number(to.slice(0, 4))
  const tm = Number(to.slice(5, 7))
  return ty * 12 + tm - (fy * 12 + fm)
}

function isEndOfMonthMonthly(t: EngineTarget): boolean {
  return t.cadence === 'monthly' && (t.dueDay === 'end' || t.dueDay === undefined)
}

function isDatedMonthlyOrWeekly(t: EngineTarget): boolean {
  if (t.cadence === 'weekly') return true
  return t.cadence === 'monthly' && t.dueDay !== 'end' && t.dueDay !== undefined
}

function applyDelta(
  assignments: AssignmentEntry[],
  categoryId: string,
  month: MonthKey,
  delta: number,
): AssignmentEntry[] {
  if (delta === 0) return assignments
  return [...assignments, { categoryId, month, delta }]
}

/**
 * Underfunded preview (A1 / A2). Extension points: tier 2 scheduled txs and tier 5 cards
 * arrive in Milestone B — keep the tier structure so those slots plug in here.
 */
function previewUnderfunded(
  snapshot: BudgetSnapshot,
  month: MonthKey,
  currentMonth: MonthKey,
  scope: AutoAssignScope,
): AutoAssignPreview {
  const selected = scope.categoryIds ? new Set(scope.categoryIds) : null
  const allowNegative = selected !== null
  let working: BudgetSnapshot = { ...snapshot, assignments: [...snapshot.assignments] }
  const order = categoryOrder(snapshot)
  const targets = targetByCategory(snapshot)
  const snoozed = new Set(
    (snapshot.snoozes ?? []).filter((s) => s.month === month).map((s) => s.categoryId),
  )

  const eligible = (id: string): boolean => {
    if (selected && !selected.has(id)) return false
    const t = targets.get(id)
    if (!t) return false
    if (isBalanceNoDue(t)) return false
    if (snoozed.has(id) && !selected) return false
    return true
  }

  const deltas: { categoryId: string; delta: number }[] = []

  const fund = (categoryId: string, amount: number) => {
    if (amount <= 0) return
    working = {
      ...working,
      assignments: applyDelta(working.assignments, categoryId, month, amount),
    }
    const existing = deltas.find((d) => d.categoryId === categoryId)
    if (existing) existing.delta += amount
    else deltas.push({ categoryId, delta: amount })
  }

  const rta = () => computeMonth(working, month).readyToAssign

  // Tier 1: overspending in the current month (assumed: cover overspend then needed)
  if (month === currentMonth) {
    const view = computeMonth(working, month)
    const overspent = order.filter((id) => {
      if (!eligible(id)) return false
      const cm = view.categories[id]
      return cm !== undefined && cm.available < 0
    })
    for (const id of overspent) {
      let remaining = allowNegative ? Number.POSITIVE_INFINITY : Math.max(0, rta())
      if (remaining <= 0 && !allowNegative) break

      const cm = computeMonth(working, month).categories[id]!
      const cover = Math.min(-cm.available, remaining)
      fund(id, cover)
      remaining = allowNegative ? Number.POSITIVE_INFINITY : Math.max(0, rta())

      const t = targets.get(id)
      if (t) {
        const after = computeMonth(working, month).categories[id]!
        const { needed } = neededForTarget(t, after, month, currentMonth, working.assignments)
        const add = Math.min(needed, remaining)
        fund(id, add)
      }
    }
  }

  // Tier 2: weekly + dated monthly (scheduled txs: Milestone B)
  // Tier 3: end-of-month monthly
  // Tier 4: custom/yearly
  // Tier 5: credit cards (Milestone B)

  const tier2: string[] = []
  const tier3: string[] = []
  const tier4: string[] = []

  for (const id of order) {
    if (!eligible(id)) continue
    const t = targets.get(id)!
    if (isDatedMonthlyOrWeekly(t)) tier2.push(id)
    else if (isEndOfMonthMonthly(t)) tier3.push(id)
    else if (t.cadence === 'custom' || t.cadence === 'yearly') tier4.push(id)
  }

  const byDue = (ids: string[]) =>
    [...ids].sort((a, b) => {
      const ra = underfundedDueRank(targets.get(a)!, month)
      const rb = underfundedDueRank(targets.get(b)!, month)
      if (ra !== rb) return ra - rb
      return order.indexOf(a) - order.indexOf(b)
    })

  for (const id of [...byDue(tier2), ...byDue(tier3), ...byDue(tier4)]) {
    let remaining = allowNegative ? Number.POSITIVE_INFINITY : Math.max(0, rta())
    if (remaining <= 0 && !allowNegative) break
    const tv = computeTargets(working, month, currentMonth)[id]
    const need = tv?.needed ?? 0
    if (need <= 0) continue
    fund(id, Math.min(need, remaining))
  }

  return {
    deltas: deltas.filter((d) => d.delta !== 0),
    readyToAssignAfter: rta(),
  }
}

function setAssignedTo(
  snapshot: BudgetSnapshot,
  month: MonthKey,
  categoryId: string,
  newAssigned: number,
): number {
  const current = assignedByCategoryMonth(snapshot.assignments, categoryId, month)
  return newAssigned - current
}

function averageAssigned(
  snapshot: BudgetSnapshot,
  categoryId: string,
  month: MonthKey,
): number {
  const values: number[] = []
  let started = false
  for (let i = 12; i >= 1; i--) {
    const m = addMonths(month, -i)
    const a = assignedByCategoryMonth(snapshot.assignments, categoryId, m)
    if (!started && a === 0) continue
    started = true
    values.push(a)
  }
  return meanNearestCentavo(values)
}

function averageSpent(snapshot: BudgetSnapshot, categoryId: string, month: MonthKey): number {
  const values: number[] = []
  let started = false
  for (let i = 12; i >= 1; i--) {
    const m = addMonths(month, -i)
    const view = computeMonth(snapshot, m)
    const cm = view.categories[categoryId]
    const spent = cm ? Math.max(0, -cm.activity) : 0
    const assigned = assignedByCategoryMonth(snapshot.assignments, categoryId, m)
    if (!started && spent === 0 && assigned === 0) continue
    started = true
    values.push(spent)
  }
  return meanNearestCentavo(values)
}

export function autoAssignPreview(
  snapshot: BudgetSnapshot,
  month: MonthKey,
  currentMonth: MonthKey,
  option: AutoAssignOption,
  scope: AutoAssignScope = {},
): AutoAssignPreview {
  const selected = scope.categoryIds
  const ids =
    selected ??
    snapshot.categories
      .filter((c) => !isHiddenish(c))
      .map((c) => c.id)

  if (option === 'underfunded') {
    return previewUnderfunded(snapshot, month, currentMonth, scope)
  }

  const view = computeMonth(snapshot, month)
  const targetViews = computeTargets(snapshot, month, currentMonth)
  const targets = targetByCategory(snapshot)
  const deltas: { categoryId: string; delta: number }[] = []

  const push = (categoryId: string, delta: number) => {
    if (delta === 0) return
    deltas.push({ categoryId, delta })
  }

  for (const id of ids) {
    switch (option) {
      case 'assigned_last_month': {
        const last = assignedByCategoryMonth(snapshot.assignments, id, addMonths(month, -1))
        push(id, setAssignedTo(snapshot, month, id, last))
        break
      }
      case 'spent_last_month': {
        const lastView = computeMonth(snapshot, addMonths(month, -1))
        const spent = Math.max(0, -(lastView.categories[id]?.activity ?? 0))
        push(id, setAssignedTo(snapshot, month, id, spent))
        break
      }
      case 'average_assigned': {
        push(id, setAssignedTo(snapshot, month, id, averageAssigned(snapshot, id, month)))
        break
      }
      case 'average_spent': {
        push(id, setAssignedTo(snapshot, month, id, averageSpent(snapshot, id, month)))
        break
      }
      case 'reduce_overfunding': {
        const t = targets.get(id)
        const tv = targetViews[id]
        if (!t || !tv || tv.snoozed) break
        const cm = view.categories[id]
        if (!cm) break
        const excess = Math.max(0, Math.min(cm.available, cm.assigned - tv.askThisMonth))
        if (excess > 0) push(id, -excess)
        break
      }
      case 'reset_available': {
        const cm = view.categories[id]
        if (!cm || cm.available <= 0) break
        push(id, -cm.available)
        break
      }
      case 'reset_assigned': {
        push(id, setAssignedTo(snapshot, month, id, 0))
        break
      }
      default:
        break
    }
  }

  let assignments = snapshot.assignments
  for (const d of deltas) {
    assignments = applyDelta(assignments, d.categoryId, month, d.delta)
  }
  const readyToAssignAfter = computeMonth({ ...snapshot, assignments }, month).readyToAssign

  return { deltas: deltas.filter((d) => d.delta !== 0), readyToAssignAfter }
}

function isHiddenish(_c: EngineCategory): boolean {
  return false
}

/** Apply preview deltas onto a snapshot (pure). */
export function applyAssignmentDeltas(
  snapshot: BudgetSnapshot,
  month: MonthKey,
  deltas: { categoryId: string; delta: number }[],
): BudgetSnapshot {
  let assignments = snapshot.assignments
  for (const d of deltas) {
    assignments = applyDelta(assignments, d.categoryId, month, d.delta)
  }
  return { ...snapshot, assignments }
}

/** Move money between categories or Ready to Assign (null). */
export function moveMoneyPreview(
  snapshot: BudgetSnapshot,
  month: MonthKey,
  fromCategoryId: string | null,
  toCategoryId: string | null,
  amount: number,
): AutoAssignPreview {
  if (amount <= 0) {
    return { deltas: [], readyToAssignAfter: computeMonth(snapshot, month).readyToAssign }
  }
  const view = computeMonth(snapshot, month)
  const deltas: { categoryId: string; delta: number }[] = []

  if (fromCategoryId) {
    const avail = view.categories[fromCategoryId]?.available ?? 0
    const take = Math.min(amount, Math.max(0, avail))
    if (take > 0) deltas.push({ categoryId: fromCategoryId, delta: -take })
    amount = take
  } else {
    const rta = Math.max(0, view.readyToAssign)
    amount = Math.min(amount, rta)
  }

  if (toCategoryId && amount > 0) {
    deltas.push({ categoryId: toCategoryId, delta: amount })
  }

  const next = applyAssignmentDeltas(snapshot, month, deltas)
  return {
    deltas,
    readyToAssignAfter: computeMonth(next, month).readyToAssign,
  }
}