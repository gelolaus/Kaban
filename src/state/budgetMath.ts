import { computeMonth, accountBalances } from '../engine/compute.ts'
import type { BudgetSnapshot, EngineTransaction, MonthView } from '../engine/types.ts'
import type { BudgetRepository } from '../storage/repository.ts'
import type {
  AccountRow,
  AssignmentRow,
  CategoryGroupRow,
  CategoryRow,
  PayeeRow,
  PinRow,
  TransactionRow,
} from '../storage/types.ts'

export interface BudgetData {
  accounts: AccountRow[]
  groups: CategoryGroupRow[]
  categories: CategoryRow[]
  payees: PayeeRow[]
  transactions: TransactionRow[]
  assignments: AssignmentRow[]
  pins: PinRow[]
}

export async function loadBudgetData(repo: BudgetRepository): Promise<BudgetData> {
  const [accounts, groups, categories, payees, transactions, assignments, pins] = await Promise.all(
    [
      repo.listAccounts(),
      repo.listCategoryGroups(),
      repo.listCategories(),
      repo.listPayees(),
      repo.listTransactions(),
      repo.listAssignments(),
      repo.listPins(),
    ],
  )
  return { accounts, groups, categories, payees, transactions, assignments, pins }
}

export function toEngineSnapshot(data: BudgetData): BudgetSnapshot {
  const accounts = data.accounts
    .filter((a) => a.on_budget && !a.closed)
    .map((a) => ({
      id: a.id,
      kind:
        a.type === 'creditCard' || a.type === 'lineOfCredit'
          ? ('credit' as const)
          : ('cash' as const),
    }))

  const categories = data.categories
    .filter((c) => !c.hidden)
    .map((c) => ({
      id: c.id,
      kind: c.kind,
      cardAccountId: c.account_id ?? undefined,
    }))

  const accountKind = new Map(accounts.map((a) => [a.id, a.kind]))

  const transactions: EngineTransaction[] = []
  for (const t of data.transactions) {
    if (!accountKind.has(t.account_id)) continue

    if (t.transfer_transaction_id) {
      const other = data.transactions.find((x) => x.id === t.transfer_transaction_id)
      if (!other) continue
      if (t.amount_centavos > 0) continue
      transactions.push({
        id: t.id,
        accountId: t.account_id,
        date: t.date,
        kind: 'transfer',
        toAccountId: other.account_id,
        amount: Math.abs(t.amount_centavos),
      })
      continue
    }

    const payee = t.payee_id ? data.payees.find((p) => p.id === t.payee_id) : null
    if (payee?.name === 'Starting Balance' && t.category_id === null) {
      const kind = accountKind.get(t.account_id)
      if (kind === 'cash' && t.amount_centavos > 0) {
        transactions.push({
          id: t.id,
          accountId: t.account_id,
          date: t.date,
          kind: 'inflow',
          amount: t.amount_centavos,
        })
      } else {
        transactions.push({
          id: t.id,
          accountId: t.account_id,
          date: t.date,
          kind: 'uncategorized',
          amount: t.amount_centavos,
        })
      }
      continue
    }

    if (t.category_id === null && t.amount_centavos > 0) {
      transactions.push({
        id: t.id,
        accountId: t.account_id,
        date: t.date,
        kind: 'inflow',
        amount: t.amount_centavos,
      })
      continue
    }

    if (t.category_id === null) {
      transactions.push({
        id: t.id,
        accountId: t.account_id,
        date: t.date,
        kind: 'uncategorized',
        amount: t.amount_centavos,
      })
      continue
    }

    transactions.push({
      id: t.id,
      accountId: t.account_id,
      date: t.date,
      kind: 'categorized',
      categoryId: t.category_id,
      amount: t.amount_centavos,
    })
  }

  const assignments = data.assignments.map((a) => ({
    categoryId: a.category_id,
    month: a.month,
    delta: a.delta_centavos,
  }))

  return { accounts, categories, transactions, assignments }
}

export function monthViewFor(data: BudgetData, month: string): MonthView {
  return computeMonth(toEngineSnapshot(data), month)
}

export function balancesFor(data: BudgetData): Record<string, number> {
  return accountBalances(toEngineSnapshot(data))
}
