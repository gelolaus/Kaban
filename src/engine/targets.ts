import { computeMonth } from './compute.ts'
import {
  addMonths,
  compareMonths,
  countWeekdayInMonth,
  monthsLeftThrough,
  type MonthKey,
} from './months.ts'
import type {
  AssignmentEntry,
  BudgetSnapshot,
  CategoryMonth,
  CategoryTargetView,
  CostToBeMe,
  EngineTarget,
  TargetBehavior,
  TargetStatus,
} from './types.ts'

/**
 * Resolve the active savings period for yearly/custom targets in `month`.
 * Period ends on dueMonth; with repeat, the next period starts the month after.
 */
export function resolvePeriod(
  target: EngineTarget,
  month: MonthKey,
): { start: MonthKey; due: MonthKey } | null {
  if (!target.dueMonth) return null
  const due = target.dueMonth
  const repeat = target.repeat ?? (target.cadence === 'yearly' ? 'yearly' : 'none')

  if (repeat === 'none') {
    if (compareMonths(month, due) > 0) return null
    return { start: '0000-01', due }
  }

  let periodDue = due
  if (compareMonths(month, due) <= 0) {
    return { start: '0000-01', due: periodDue }
  }

  const step = repeat === 'yearly' ? 12 : 1
  for (;;) {
    const nextStart = addMonths(periodDue, 1)
    const nextDue = addMonths(periodDue, step)
    if (compareMonths(month, nextDue) <= 0) {
      return { start: nextStart, due: nextDue }
    }
    periodDue = nextDue
  }
}

function effectiveBehavior(target: EngineTarget, month: MonthKey): TargetBehavior {
  if (target.behavior !== 'set_aside') return target.behavior
  if (
    (target.cadence === 'custom' || target.cadence === 'yearly') &&
    target.repeat &&
    target.repeat !== 'none' &&
    target.repeatBehavior
  ) {
    const period = resolvePeriod(target, month)
    if (period && period.due !== target.dueMonth) {
      return target.repeatBehavior
    }
  }
  return target.behavior
}

function ceilDiv(num: number, den: number): number {
  if (den <= 0) return 0
  return Math.ceil(num / den)
}

function assignedInPeriodBefore(
  assignments: AssignmentEntry[],
  categoryId: string,
  month: MonthKey,
  periodStart: MonthKey,
  periodDue: MonthKey,
): number {
  let total = 0
  for (const a of assignments) {
    if (a.categoryId !== categoryId) continue
    if (compareMonths(a.month, month) >= 0) continue
    if (compareMonths(a.month, periodStart) < 0) continue
    if (compareMonths(a.month, periodDue) > 0) continue
    total += a.delta
  }
  return total
}

export function neededForTarget(
  target: EngineTarget,
  cm: CategoryMonth,
  month: MonthKey,
  currentMonth: MonthKey,
  assignments: AssignmentEntry[],
): { needed: number; askThisMonth: number } {
  const T = target.amount
  const assigned = cm.assigned
  const carried = cm.carried
  const isFuture = compareMonths(month, currentMonth) > 0
  const behavior = effectiveBehavior(target, month)

  if (target.cadence === 'monthly') {
    if (behavior === 'set_aside') {
      return { needed: Math.max(0, T - assigned), askThisMonth: T }
    }
    if (isFuture) {
      return { needed: Math.max(0, T - assigned), askThisMonth: T }
    }
    const needed = Math.max(0, T - (carried + assigned))
    return { needed, askThisMonth: needed + assigned }
  }

  if (target.cadence === 'weekly') {
    const full = T * countWeekdayInMonth(month, target.weekday ?? 0)
    if (behavior === 'set_aside') {
      return { needed: Math.max(0, full - assigned), askThisMonth: full }
    }
    if (isFuture) {
      return { needed: Math.max(0, full - assigned), askThisMonth: full }
    }
    const needed = Math.max(0, full - (carried + assigned))
    return { needed, askThisMonth: needed + assigned }
  }

  if (behavior === 'balance' && !target.dueMonth) {
    const needed = Math.max(0, T - (carried + assigned))
    return { needed, askThisMonth: T }
  }

  const period = resolvePeriod(target, month)
  if (!period) return { needed: 0, askThisMonth: 0 }
  const left = monthsLeftThrough(month, period.due)
  if (left <= 0) return { needed: 0, askThisMonth: 0 }

  if (behavior === 'set_aside') {
    const before = assignedInPeriodBefore(
      assignments,
      target.categoryId,
      month,
      period.start,
      period.due,
    )
    const slice = ceilDiv(Math.max(0, T - before), left)
    const needed = Math.max(0, slice - assigned)
    return { needed, askThisMonth: slice }
  }

  const slice = ceilDiv(Math.max(0, T - carried), left)
  const needed = Math.max(0, slice - assigned)
  return { needed, askThisMonth: slice }
}

function statusFor(
  cm: CategoryMonth,
  needed: number,
  snoozed: boolean,
  target: EngineTarget,
): TargetStatus {
  if (cm.cashOverspending > 0) return 'overspent'
  if (cm.creditOverspending > 0) return 'credit_overspent'
  if (snoozed) return 'snoozed'
  // T8: savings balance without a due date shows green whenever Available > 0
  if (target.behavior === 'balance' && !target.dueMonth) {
    return cm.available > 0 ? 'positive' : 'zero'
  }
  if (needed > 0) return 'underfunded'
  if (target.cadence === 'monthly' || target.cadence === 'weekly' || target.dueMonth) {
    return 'funded'
  }
  if (cm.available > 0) return 'positive'
  return 'zero'
}

function progressFor(
  target: EngineTarget,
  cm: CategoryMonth,
  needed: number,
  askThisMonth: number,
): number {
  if (target.behavior === 'balance') {
    if (target.amount <= 0) return 0
    return Math.min(1, Math.max(0, cm.available) / target.amount)
  }
  if (askThisMonth <= 0) return 1
  const fundedSoFar = askThisMonth - needed
  return Math.min(1, Math.max(0, fundedSoFar) / askThisMonth)
}

export function computeTargets(
  snapshot: BudgetSnapshot,
  month: MonthKey,
  currentMonth: MonthKey,
): Record<string, CategoryTargetView> {
  const targets = snapshot.targets ?? []
  if (targets.length === 0) return {}
  const view = computeMonth(snapshot, month)
  const snoozeSet = new Set(
    (snapshot.snoozes ?? []).filter((s) => s.month === month).map((s) => s.categoryId),
  )

  const out: Record<string, CategoryTargetView> = {}
  for (const target of targets) {
    const cm = view.categories[target.categoryId] ?? {
      categoryId: target.categoryId,
      carried: 0,
      assigned: 0,
      cashActivity: 0,
      creditActivity: 0,
      activity: 0,
      available: 0,
      cashOverspending: 0,
      creditOverspending: 0,
    }
    const snoozed = snoozeSet.has(target.categoryId)
    let { needed, askThisMonth } = neededForTarget(
      target,
      cm,
      month,
      currentMonth,
      snapshot.assignments,
    )
    if (snoozed) needed = 0
    out[target.categoryId] = {
      categoryId: target.categoryId,
      needed,
      askThisMonth,
      status: statusFor(cm, needed, snoozed, target),
      snoozed,
      progress: progressFor(target, cm, needed, askThisMonth),
    }
  }
  return out
}

/** Full monthly ask for Cost to Be Me (C1), ignoring how much is already funded. */
export function fullAskThisMonth(
  target: EngineTarget,
  month: MonthKey,
  assignments: AssignmentEntry[],
  carried: number,
): number {
  const T = target.amount
  if (target.cadence === 'weekly') {
    return T * countWeekdayInMonth(month, target.weekday ?? 0)
  }
  if (target.cadence === 'monthly') return T
  if (target.behavior === 'balance' && !target.dueMonth) return T

  const period = resolvePeriod(target, month)
  if (!period) return 0
  const left = monthsLeftThrough(month, period.due)
  if (left <= 0) return 0

  const behavior = effectiveBehavior(target, month)
  if (behavior === 'set_aside') {
    const before = assignedInPeriodBefore(
      assignments,
      target.categoryId,
      month,
      period.start,
      period.due,
    )
    return ceilDiv(Math.max(0, T - before), left)
  }
  return ceilDiv(Math.max(0, T - carried), left)
}

export function costToBeMe(
  snapshot: BudgetSnapshot,
  month: MonthKey,
  _currentMonth: MonthKey,
  expectedIncome: number,
): CostToBeMe {
  const targets = snapshot.targets ?? []
  const thisView = computeMonth(snapshot, month)
  let thisMonth = 0
  for (const target of targets) {
    const carried = thisView.categories[target.categoryId]?.carried ?? 0
    thisMonth += fullAskThisMonth(target, month, snapshot.assignments, carried)
  }

  const nextKey = addMonths(month, 1)
  const nextView = computeMonth(snapshot, nextKey)
  let nextTotal = 0
  for (const target of targets) {
    const carried = nextView.categories[target.categoryId]?.carried ?? 0
    nextTotal += fullAskThisMonth(target, nextKey, snapshot.assignments, carried)
  }

  return {
    thisMonth,
    nextMonth: nextTotal > thisMonth ? nextTotal : null,
    margin: expectedIncome - thisMonth,
  }
}

/** Refuse snoozing a future month or a credit card payment category (Z2, Z5). */
export function canSnooze(
  categoryKind: 'normal' | 'credit_card_payment',
  month: MonthKey,
  currentMonth: MonthKey,
): boolean {
  if (categoryKind === 'credit_card_payment') return false
  return month === currentMonth
}
