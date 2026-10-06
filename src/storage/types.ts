export type AccountType = 'checking' | 'savings' | 'cash' | 'creditCard' | 'lineOfCredit'

export interface BudgetRow {
  id: string
  name: string
  currency: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AccountRow {
  id: string
  budget_id: string
  name: string
  type: AccountType
  on_budget: number
  closed: number
  sort_order: number
  note: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CategoryGroupRow {
  id: string
  budget_id: string
  name: string
  sort_order: number
  hidden: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CategoryRow {
  id: string
  budget_id: string
  group_id: string
  name: string
  sort_order: number
  hidden: number
  note: string | null
  kind: 'normal' | 'credit_card_payment'
  account_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface PayeeRow {
  id: string
  budget_id: string
  name: string
  transfer_account_id: string | null
  last_category_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface TransactionRow {
  id: string
  budget_id: string
  account_id: string
  date: string
  payee_id: string | null
  category_id: string | null
  memo: string | null
  amount_centavos: number
  cleared: 'uncleared' | 'cleared' | 'reconciled'
  approved: number
  transfer_transaction_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AssignmentRow {
  id: string
  budget_id: string
  category_id: string
  month: string
  delta_centavos: number
  move_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface PinRow {
  id: string
  budget_id: string
  category_id: string
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TargetCadence = 'weekly' | 'monthly' | 'yearly' | 'custom'
export type TargetBehavior = 'set_aside' | 'refill' | 'balance'
export type TargetRepeat = 'none' | 'monthly' | 'yearly'
export type MoveKind = 'assign' | 'move' | 'auto_assign' | 'cover' | 'delete_category'

export interface TargetRow {
  id: string
  budget_id: string
  category_id: string
  cadence: TargetCadence
  behavior: TargetBehavior
  amount_centavos: number
  weekday: number | null
  due_day: string | null
  due_month: string | null
  repeat: TargetRepeat | null
  repeat_behavior: 'set_aside' | 'refill' | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface TargetSnoozeRow {
  id: string
  budget_id: string
  category_id: string
  month: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface MoveRow {
  id: string
  budget_id: string
  kind: MoveKind
  month: string
  undone_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface BudgetSettingRow {
  id: string
  budget_id: string
  key: string
  value: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type BackupPayloadV1 = {
  version: 1
  exportedAt: string
  budgets: BudgetRow[]
  accounts: AccountRow[]
  categoryGroups: CategoryGroupRow[]
  categories: CategoryRow[]
  payees: PayeeRow[]
  transactions: TransactionRow[]
  assignments: AssignmentRow[]
  pins: PinRow[]
}

export type BackupPayloadV2 = {
  version: 2
  exportedAt: string
  budgets: BudgetRow[]
  accounts: AccountRow[]
  categoryGroups: CategoryGroupRow[]
  categories: CategoryRow[]
  payees: PayeeRow[]
  transactions: TransactionRow[]
  assignments: AssignmentRow[]
  pins: PinRow[]
  targets: TargetRow[]
  targetSnoozes: TargetSnoozeRow[]
  moves: MoveRow[]
  settings: BudgetSettingRow[]
}

export type BackupPayload = BackupPayloadV1 | BackupPayloadV2
