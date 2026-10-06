import type { MonthKey } from './months.ts'

export interface EngineAccount {
  id: string
  kind: 'cash' | 'credit'
}

export interface EngineCategory {
  id: string
  kind: 'normal' | 'credit_card_payment'
  cardAccountId?: string
}

export type EngineTransaction =
  | { id: string; accountId: string; date: string; kind: 'inflow'; amount: number }
  | {
      id: string
      accountId: string
      date: string
      kind: 'categorized'
      categoryId: string
      amount: number
    }
  | {
      id: string
      accountId: string
      date: string
      kind: 'transfer'
      toAccountId: string
      amount: number
    }
  | { id: string; accountId: string; date: string; kind: 'uncategorized'; amount: number }

export interface AssignmentEntry {
  categoryId: string
  month: MonthKey
  delta: number
}

export type TargetCadence = 'weekly' | 'monthly' | 'yearly' | 'custom'
export type TargetBehavior = 'set_aside' | 'refill' | 'balance'
export type TargetRepeat = 'none' | 'monthly' | 'yearly'

export interface EngineTarget {
  categoryId: string
  cadence: TargetCadence
  behavior: TargetBehavior
  amount: number
  weekday?: number
  dueDay?: number | 'end'
  dueMonth?: MonthKey
  repeat?: TargetRepeat
  repeatBehavior?: 'set_aside' | 'refill'
}

export interface EngineSnooze {
  categoryId: string
  month: MonthKey
}

export interface BudgetSnapshot {
  accounts: EngineAccount[]
  categories: EngineCategory[]
  transactions: EngineTransaction[]
  assignments: AssignmentEntry[]
  targets?: EngineTarget[]
  snoozes?: EngineSnooze[]
}

export type TargetStatus =
  'overspent' | 'credit_overspent' | 'underfunded' | 'funded' | 'snoozed' | 'positive' | 'zero'

export interface CategoryTargetView {
  categoryId: string
  needed: number
  askThisMonth: number
  status: TargetStatus
  snoozed: boolean
  progress: number
}

export type AutoAssignOption =
  | 'underfunded'
  | 'assigned_last_month'
  | 'spent_last_month'
  | 'average_assigned'
  | 'average_spent'
  | 'reduce_overfunding'
  | 'reset_available'
  | 'reset_assigned'

export interface AutoAssignDelta {
  categoryId: string
  delta: number
}

export interface AutoAssignPreview {
  deltas: AutoAssignDelta[]
  readyToAssignAfter: number
}

export interface CostToBeMe {
  thisMonth: number
  nextMonth: number | null
  margin: number
}

export interface CategoryMonth {
  categoryId: string
  carried: number
  assigned: number
  cashActivity: number
  creditActivity: number
  activity: number
  available: number
  cashOverspending: number
  creditOverspending: number
}

export interface MonthSummary {
  leftOver: number
  assigned: number
  activity: number
  available: number
  assignedInFuture: number
}

export interface EngineWarning {
  code: 'unknown_category' | 'unknown_account' | 'invalid_date' | 'unsupported'
  transactionId: string
  message: string
}

export interface MonthView {
  month: MonthKey
  readyToAssign: number
  categories: Record<string, CategoryMonth>
  summary: MonthSummary
  warnings: EngineWarning[]
}
