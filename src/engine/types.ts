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

export interface BudgetSnapshot {
  accounts: EngineAccount[]
  categories: EngineCategory[]
  transactions: EngineTransaction[]
  assignments: AssignmentEntry[]
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
