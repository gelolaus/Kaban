import { ulid } from 'ulid'
import type { Db } from './db.ts'
import type {
  AccountRow,
  AccountType,
  AssignmentRow,
  BackupPayload,
  BudgetRow,
  CategoryGroupRow,
  CategoryRow,
  PayeeRow,
  PinRow,
  TransactionRow,
} from './types.ts'

function now(): string {
  return new Date().toISOString()
}

export class BudgetRepository {
  readonly budgetId: string
  private readonly db: Db

  constructor(db: Db, budgetId: string) {
    this.db = db
    this.budgetId = budgetId
  }

  static async ensureBudget(db: Db): Promise<BudgetRepository> {
    const stmt = await db.prepare(
      `SELECT id, name, currency, created_at, updated_at, deleted_at FROM budgets WHERE deleted_at IS NULL LIMIT 1`,
    )
    const existing = (await stmt.get()) as BudgetRow | undefined
    if (existing) return new BudgetRepository(db, existing.id)

    const id = ulid()
    const ts = now()
    const insert = await db.prepare(
      `INSERT INTO budgets (id, name, currency, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)`,
    )
    await insert.run(id, 'Kaban', 'PHP', ts, ts)

    const repo = new BudgetRepository(db, id)
    await repo.seedDefaults()
    return repo
  }

  private async seedDefaults(): Promise<void> {
    const ts = now()
    const groupId = ulid()
    const gInsert = await this.db.prepare(
      `INSERT INTO category_groups (id, budget_id, name, sort_order, hidden, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, 0, 0, ?, ?, NULL)`,
    )
    await gInsert.run(groupId, this.budgetId, 'Immediate obligations', ts, ts)

    for (const [i, name] of ['Groceries', 'Dining out'].entries()) {
      const id = ulid()
      const c = await this.db.prepare(
        `INSERT INTO categories (id, budget_id, group_id, name, sort_order, hidden, note, kind, account_id, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, 0, NULL, 'normal', NULL, ?, ?, NULL)`,
      )
      await c.run(id, this.budgetId, groupId, name, i, ts, ts)
    }
  }

  async getBudget(): Promise<BudgetRow> {
    const stmt = await this.db.prepare(`SELECT * FROM budgets WHERE id = ? AND deleted_at IS NULL`)
    return (await stmt.get(this.budgetId)) as BudgetRow
  }

  async listAccounts(): Promise<AccountRow[]> {
    const stmt = await this.db.prepare(
      `SELECT * FROM accounts WHERE budget_id = ? AND deleted_at IS NULL ORDER BY sort_order, name`,
    )
    return (await stmt.all(this.budgetId)) as AccountRow[]
  }

  async listCategoryGroups(): Promise<CategoryGroupRow[]> {
    const stmt = await this.db.prepare(
      `SELECT * FROM category_groups WHERE budget_id = ? AND deleted_at IS NULL ORDER BY sort_order, name`,
    )
    return (await stmt.all(this.budgetId)) as CategoryGroupRow[]
  }

  async listCategories(): Promise<CategoryRow[]> {
    const stmt = await this.db.prepare(
      `SELECT * FROM categories WHERE budget_id = ? AND deleted_at IS NULL ORDER BY sort_order, name`,
    )
    return (await stmt.all(this.budgetId)) as CategoryRow[]
  }

  async listPayees(): Promise<PayeeRow[]> {
    const stmt = await this.db.prepare(
      `SELECT * FROM payees WHERE budget_id = ? AND deleted_at IS NULL ORDER BY name`,
    )
    return (await stmt.all(this.budgetId)) as PayeeRow[]
  }

  async listTransactions(): Promise<TransactionRow[]> {
    const stmt = await this.db.prepare(
      `SELECT * FROM transactions WHERE budget_id = ? AND deleted_at IS NULL ORDER BY date DESC, id DESC`,
    )
    return (await stmt.all(this.budgetId)) as TransactionRow[]
  }

  async listAssignments(): Promise<AssignmentRow[]> {
    const stmt = await this.db.prepare(
      `SELECT * FROM assignment_entries WHERE budget_id = ? AND deleted_at IS NULL`,
    )
    return (await stmt.all(this.budgetId)) as AssignmentRow[]
  }

  async listPins(): Promise<PinRow[]> {
    const stmt = await this.db.prepare(
      `SELECT * FROM pins WHERE budget_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
    )
    return (await stmt.all(this.budgetId)) as PinRow[]
  }

  async createAccount(input: {
    name: string
    type: AccountType
    startingBalanceCentavos: number
  }): Promise<AccountRow> {
    const ts = now()
    const id = ulid()
    const onBudget = 1
    const isCredit = input.type === 'creditCard' || input.type === 'lineOfCredit'
    const sort = (await this.listAccounts()).length
    const insert = await this.db.prepare(
      `INSERT INTO accounts (id, budget_id, name, type, on_budget, closed, sort_order, note, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, NULL, ?, ?, NULL)`,
    )
    await insert.run(id, this.budgetId, input.name, input.type, onBudget, sort, ts, ts)

    if (isCredit) {
      // payment category
      let creditGroup = (await this.listCategoryGroups()).find(
        (g) => g.name === 'Credit card payments',
      )
      if (!creditGroup) {
        const gid = ulid()
        const gIns = await this.db.prepare(
          `INSERT INTO category_groups (id, budget_id, name, sort_order, hidden, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, 100, 0, ?, ?, NULL)`,
        )
        await gIns.run(gid, this.budgetId, 'Credit card payments', ts, ts)
        creditGroup = {
          id: gid,
          budget_id: this.budgetId,
          name: 'Credit card payments',
          sort_order: 100,
          hidden: 0,
          created_at: ts,
          updated_at: ts,
          deleted_at: null,
        }
      }
      const catId = ulid()
      const cIns = await this.db.prepare(
        `INSERT INTO categories (id, budget_id, group_id, name, sort_order, hidden, note, kind, account_id, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, 0, 0, NULL, 'credit_card_payment', ?, ?, ?, NULL)`,
      )
      await cIns.run(catId, this.budgetId, creditGroup.id, input.name, id, ts, ts)

      if (input.startingBalanceCentavos !== 0) {
        await this.insertTransaction({
          accountId: id,
          date: ts.slice(0, 10),
          amountCentavos: -Math.abs(input.startingBalanceCentavos),
          memo: 'Starting balance',
          cleared: 'cleared',
          categoryId: null,
          payeeName: 'Starting Balance',
        })
      }
    } else if (input.startingBalanceCentavos !== 0) {
      await this.insertTransaction({
        accountId: id,
        date: ts.slice(0, 10),
        amountCentavos: input.startingBalanceCentavos,
        memo: 'Starting balance',
        cleared: 'cleared',
        categoryId: null,
        payeeName: 'Starting Balance',
        inflowToRta: true,
      })
    }

    const accounts = await this.listAccounts()
    return accounts.find((a) => a.id === id)!
  }

  async insertTransaction(input: {
    accountId: string
    date: string
    amountCentavos: number
    memo?: string | null
    cleared?: TransactionRow['cleared']
    categoryId?: string | null
    payeeId?: string | null
    payeeName?: string
    inflowToRta?: boolean
    transferAccountId?: string
  }): Promise<TransactionRow> {
    const ts = now()
    let payeeId = input.payeeId ?? null
    if (!payeeId && input.payeeName) {
      payeeId = await this.ensurePayee(input.payeeName, input.transferAccountId)
    }

    const id = ulid()
    const categoryId = input.inflowToRta ? null : (input.categoryId ?? null)
    const insert = await this.db.prepare(
      `INSERT INTO transactions (id, budget_id, account_id, date, payee_id, category_id, memo, amount_centavos, cleared, approved, transfer_transaction_id, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, NULL)`,
    )
    await insert.run(
      id,
      this.budgetId,
      input.accountId,
      input.date,
      payeeId,
      categoryId,
      input.memo ?? null,
      input.amountCentavos,
      input.cleared ?? 'uncleared',
      ts,
      ts,
    )

    if (input.transferAccountId) {
      const otherId = ulid()
      const other = await this.db.prepare(
        `INSERT INTO transactions (id, budget_id, account_id, date, payee_id, category_id, memo, amount_centavos, cleared, approved, transfer_transaction_id, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, ?, ?, ?, NULL)`,
      )
      await other.run(
        otherId,
        this.budgetId,
        input.transferAccountId,
        input.date,
        payeeId,
        input.memo ?? null,
        -input.amountCentavos,
        input.cleared ?? 'uncleared',
        id,
        ts,
        ts,
      )
      const link = await this.db.prepare(
        `UPDATE transactions SET transfer_transaction_id = ?, updated_at = ? WHERE id = ?`,
      )
      await link.run(otherId, ts, id)
    }

    const rows = await this.listTransactions()
    return rows.find((t) => t.id === id)!
  }

  async updateTransaction(
    id: string,
    patch: Partial<{
      date: string
      amountCentavos: number
      memo: string | null
      cleared: TransactionRow['cleared']
      categoryId: string | null
      payeeId: string | null
      accountId: string
    }>,
  ): Promise<void> {
    const ts = now()
    const current = (await this.listTransactions()).find((t) => t.id === id)
    if (!current) return
    const upd = await this.db.prepare(
      `UPDATE transactions SET date = ?, amount_centavos = ?, memo = ?, cleared = ?, category_id = ?, payee_id = ?, account_id = ?, updated_at = ? WHERE id = ?`,
    )
    await upd.run(
      patch.date ?? current.date,
      patch.amountCentavos ?? current.amount_centavos,
      patch.memo === undefined ? current.memo : patch.memo,
      patch.cleared ?? current.cleared,
      patch.categoryId === undefined ? current.category_id : patch.categoryId,
      patch.payeeId === undefined ? current.payee_id : patch.payeeId,
      patch.accountId ?? current.account_id,
      ts,
      id,
    )
  }

  async deleteTransaction(id: string): Promise<void> {
    const ts = now()
    const current = (await this.listTransactions()).find((t) => t.id === id)
    const soft = await this.db.prepare(
      `UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ? OR transfer_transaction_id = ?`,
    )
    await soft.run(ts, ts, id, id)
    if (current?.transfer_transaction_id) {
      await soft.run(ts, ts, current.transfer_transaction_id, current.transfer_transaction_id)
    }
  }

  async assign(categoryId: string, month: string, newAssignedCentavos: number): Promise<void> {
    const entries = (await this.listAssignments()).filter(
      (a) => a.category_id === categoryId && a.month === month,
    )
    const current = entries.reduce((s, e) => s + e.delta_centavos, 0)
    const delta = newAssignedCentavos - current
    if (delta === 0) return
    const ts = now()
    const id = ulid()
    const ins = await this.db.prepare(
      `INSERT INTO assignment_entries (id, budget_id, category_id, month, delta_centavos, move_id, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
    )
    await ins.run(id, this.budgetId, categoryId, month, delta, ts, ts)
  }

  async createCategoryGroup(name: string): Promise<CategoryGroupRow> {
    const ts = now()
    const id = ulid()
    const sort = (await this.listCategoryGroups()).length
    const ins = await this.db.prepare(
      `INSERT INTO category_groups (id, budget_id, name, sort_order, hidden, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, NULL)`,
    )
    await ins.run(id, this.budgetId, name, sort, ts, ts)
    return (await this.listCategoryGroups()).find((g) => g.id === id)!
  }

  async createCategory(groupId: string, name: string): Promise<CategoryRow> {
    const ts = now()
    const id = ulid()
    const sort = (await this.listCategories()).filter((c) => c.group_id === groupId).length
    const ins = await this.db.prepare(
      `INSERT INTO categories (id, budget_id, group_id, name, sort_order, hidden, note, kind, account_id, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL, 'normal', NULL, ?, ?, NULL)`,
    )
    await ins.run(id, this.budgetId, groupId, name, sort, ts, ts)
    return (await this.listCategories()).find((c) => c.id === id)!
  }

  async renameCategory(id: string, name: string): Promise<void> {
    const ts = now()
    const upd = await this.db.prepare(`UPDATE categories SET name = ?, updated_at = ? WHERE id = ?`)
    await upd.run(name, ts, id)
  }

  async renameCategoryGroup(id: string, name: string): Promise<void> {
    const ts = now()
    const upd = await this.db.prepare(
      `UPDATE category_groups SET name = ?, updated_at = ? WHERE id = ?`,
    )
    await upd.run(name, ts, id)
  }

  async hideCategory(id: string, hidden: boolean): Promise<void> {
    const ts = now()
    const upd = await this.db.prepare(
      `UPDATE categories SET hidden = ?, updated_at = ? WHERE id = ?`,
    )
    await upd.run(hidden ? 1 : 0, ts, id)
  }

  async hideCategoryGroup(id: string, hidden: boolean): Promise<void> {
    const ts = now()
    const upd = await this.db.prepare(
      `UPDATE category_groups SET hidden = ?, updated_at = ? WHERE id = ?`,
    )
    await upd.run(hidden ? 1 : 0, ts, id)
  }

  async reorderCategories(orderedIds: string[]): Promise<void> {
    const ts = now()
    const upd = await this.db.prepare(
      `UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?`,
    )
    for (const [i, id] of orderedIds.entries()) {
      await upd.run(i, ts, id)
    }
  }

  async reorderCategoryGroups(orderedIds: string[]): Promise<void> {
    const ts = now()
    const upd = await this.db.prepare(
      `UPDATE category_groups SET sort_order = ?, updated_at = ? WHERE id = ?`,
    )
    for (const [i, id] of orderedIds.entries()) {
      await upd.run(i, ts, id)
    }
  }

  async ensurePayee(name: string, transferAccountId?: string): Promise<string> {
    const existing = (await this.listPayees()).find((p) => p.name === name)
    if (existing) return existing.id
    const ts = now()
    const id = ulid()
    const ins = await this.db.prepare(
      `INSERT INTO payees (id, budget_id, name, transfer_account_id, last_category_id, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, NULL)`,
    )
    await ins.run(id, this.budgetId, name, transferAccountId ?? null, ts, ts)
    return id
  }

  async exportBackup(): Promise<BackupPayload> {
    return {
      version: 1,
      exportedAt: now(),
      budgets: [await this.getBudget()],
      accounts: await this.listAccounts(),
      categoryGroups: await this.listCategoryGroups(),
      categories: await this.listCategories(),
      payees: await this.listPayees(),
      transactions: await this.listTransactions(),
      assignments: await this.listAssignments(),
      pins: await this.listPins(),
    }
  }

  async importBackup(payload: BackupPayload): Promise<void> {
    // Soft-delete current then insert
    const ts = now()
    for (const table of [
      'pins',
      'assignment_entries',
      'transactions',
      'payees',
      'categories',
      'category_groups',
      'accounts',
    ]) {
      await this.db.exec(
        `UPDATE ${table} SET deleted_at = '${ts}', updated_at = '${ts}' WHERE budget_id = '${this.budgetId}' AND deleted_at IS NULL`,
      )
    }

    const insertAll = async (sql: string, rows: unknown[][]) => {
      const stmt = await this.db.prepare(sql)
      for (const row of rows) await stmt.run(...row)
    }

    await insertAll(
      `INSERT OR REPLACE INTO accounts (id, budget_id, name, type, on_budget, closed, sort_order, note, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      payload.accounts.map((a) => [
        a.id,
        this.budgetId,
        a.name,
        a.type,
        a.on_budget,
        a.closed,
        a.sort_order,
        a.note,
        a.created_at,
        a.updated_at,
        a.deleted_at,
      ]),
    )
    await insertAll(
      `INSERT OR REPLACE INTO category_groups (id, budget_id, name, sort_order, hidden, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      payload.categoryGroups.map((g) => [
        g.id,
        this.budgetId,
        g.name,
        g.sort_order,
        g.hidden,
        g.created_at,
        g.updated_at,
        g.deleted_at,
      ]),
    )
    await insertAll(
      `INSERT OR REPLACE INTO categories (id, budget_id, group_id, name, sort_order, hidden, note, kind, account_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      payload.categories.map((c) => [
        c.id,
        this.budgetId,
        c.group_id,
        c.name,
        c.sort_order,
        c.hidden,
        c.note,
        c.kind,
        c.account_id,
        c.created_at,
        c.updated_at,
        c.deleted_at,
      ]),
    )
    await insertAll(
      `INSERT OR REPLACE INTO payees (id, budget_id, name, transfer_account_id, last_category_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      payload.payees.map((p) => [
        p.id,
        this.budgetId,
        p.name,
        p.transfer_account_id,
        p.last_category_id,
        p.created_at,
        p.updated_at,
        p.deleted_at,
      ]),
    )
    await insertAll(
      `INSERT OR REPLACE INTO transactions (id, budget_id, account_id, date, payee_id, category_id, memo, amount_centavos, cleared, approved, transfer_transaction_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      payload.transactions.map((t) => [
        t.id,
        this.budgetId,
        t.account_id,
        t.date,
        t.payee_id,
        t.category_id,
        t.memo,
        t.amount_centavos,
        t.cleared,
        t.approved,
        t.transfer_transaction_id,
        t.created_at,
        t.updated_at,
        t.deleted_at,
      ]),
    )
    await insertAll(
      `INSERT OR REPLACE INTO assignment_entries (id, budget_id, category_id, month, delta_centavos, move_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      payload.assignments.map((a) => [
        a.id,
        this.budgetId,
        a.category_id,
        a.month,
        a.delta_centavos,
        a.move_id,
        a.created_at,
        a.updated_at,
        a.deleted_at,
      ]),
    )
    await insertAll(
      `INSERT OR REPLACE INTO pins (id, budget_id, category_id, sort_order, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      payload.pins.map((p) => [
        p.id,
        this.budgetId,
        p.category_id,
        p.sort_order,
        p.created_at,
        p.updated_at,
        p.deleted_at,
      ]),
    )
  }

  async clearAllData(): Promise<void> {
    for (const table of [
      'pins',
      'assignment_entries',
      'transactions',
      'payees',
      'categories',
      'category_groups',
      'accounts',
      'month_notes',
      'budgets',
      'meta',
    ]) {
      await this.db.exec(`DELETE FROM ${table}`)
    }
  }
}
