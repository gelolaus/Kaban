import type { MonthKey } from './months.ts'
import type {
  AssignmentEntry,
  BudgetSnapshot,
  EngineAccount,
  EngineCategory,
  EngineTransaction,
} from './types.ts'

export function cash(id: string): EngineAccount {
  return { id, kind: 'cash' }
}

export function card(id: string): EngineAccount {
  return { id, kind: 'credit' }
}

export function normal(id: string): EngineCategory {
  return { id, kind: 'normal' }
}

export function payment(id: string, cardAccountId: string): EngineCategory {
  return { id, kind: 'credit_card_payment', cardAccountId }
}

export function inflow(
  id: string,
  accountId: string,
  date: string,
  amount: number,
): EngineTransaction {
  return { id, accountId, date, kind: 'inflow', amount }
}

export function spend(
  id: string,
  accountId: string,
  date: string,
  categoryId: string,
  amount: number,
): EngineTransaction {
  return { id, accountId, date, kind: 'categorized', categoryId, amount: -amount }
}

export function refund(
  id: string,
  accountId: string,
  date: string,
  categoryId: string,
  amount: number,
): EngineTransaction {
  return { id, accountId, date, kind: 'categorized', categoryId, amount }
}

export function pay(
  id: string,
  fromAccountId: string,
  toCardId: string,
  date: string,
  amount: number,
): EngineTransaction {
  return {
    id,
    accountId: fromAccountId,
    date,
    kind: 'transfer',
    toAccountId: toCardId,
    amount,
  }
}

export function plain(
  id: string,
  accountId: string,
  date: string,
  amount: number,
): EngineTransaction {
  return { id, accountId, date, kind: 'uncategorized', amount }
}

export function assign(categoryId: string, month: MonthKey, delta: number): AssignmentEntry {
  return { categoryId, month, delta }
}

export function snap(parts: Partial<BudgetSnapshot>): BudgetSnapshot {
  return {
    accounts: parts.accounts ?? [],
    categories: parts.categories ?? [],
    transactions: parts.transactions ?? [],
    assignments: parts.assignments ?? [],
  }
}
