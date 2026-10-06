import { computeMonth, accountBalances } from '../engine/compute.ts'
import type { BudgetSnapshot, EngineTransaction, MonthView } from '../engine/types.ts'
import type { BudgetRepository } from '../storage/repository.ts'
import type {
  AccountRow,
  AssignmentRow,
  BudgetSettingRow,
  CategoryGroupRow,
  CategoryRow,
  PayeeRow,
  PinRow,
  TargetRow,
  TargetSnoozeRow,
  TransactionRow,
} from '../storage/types.ts'
import type { EngineTarget } from '../engine/types.ts'

export interface BudgetData {
  accounts: AccountRow[]
  groups: CategoryGroupRow[]
  categories: CategoryRow[]
  payees: PayeeRow[]
  transactions: TransactionRow[]
  assignments: AssignmentRow[]
  pins: PinRow[]
  targets: TargetRow[]
  snoozes: TargetSnoozeRow[]
  settings: BudgetSettingRow[]
}

export async function loadBudgetData(repo: BudgetRepository): Promise<BudgetData> {
  const [
    accounts,
    groups,
    categories,
    payees,
    transactions,
    assignments,
    pins,
    targets,
    snoozes,
    settings,
  ] = await Promise.all([
    repo.listAccounts(),
    repo.listCategoryGroups(),
    repo.listCategories(),
    repo.listPayees(),
    repo.listTransactions(),
    repo.listAssignments(),
    repo.listPins(),
    repo.listTargets(),
    repo.listTargetSnoozes(),
    repo.listSettings(),
  ])
  return {
    accounts,
    groups,
    categories,
    payees,
    transactions,
    assignments,
    pins,
    targets,
    snoozes,
    settings,
  }
}

function rowToEngineTarget(t: TargetRow): EngineTarget {
  let dueDay: number | 'end' | undefined
  if (t.due_day === 'end') dueDay = 'end'
  else if (t.due_day !== null) {
    const n = Number(t.due_day)
    if (Number.isInteger(n)) dueDay = n
  }
  return {
    categoryId: t.category_id,
    cadence: t.cadence,
    behavior: t.behavior,
    amount: t.amount_centavos,
    weekday: t.weekday ?? undefined,
    dueDay,
    dueMonth: t.due_month ?? undefined,
    repeat: t.repeat ?? undefined,
    repeatBehavior: t.repeat_behavior ?? undefined,
  }
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

  return {
    accounts,
    categories,
    transactions,
    assignments,
    targets: data.targets.map(rowToEngineTarget),
    snoozes: data.snoozes.map((s) => ({ categoryId: s.category_id, month: s.month })),
  }
}

export function monthViewFor(data: BudgetData, month: string): MonthView {
  return computeMonth(toEngineSnapshot(data), month)
}

export function balancesFor(data: BudgetData): Record<string, number> {
  return accountBalances(toEngineSnapshot(data))
}
