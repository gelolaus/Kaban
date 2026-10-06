import { ulid } from 'ulid'
import type { Db } from './db.ts'
import type {
  AccountRow,
  AccountType,
  AssignmentRow,
  BackupPayload,
  BudgetRow,
  BudgetSettingRow,
  CategoryGroupRow,
  CategoryRow,
  MoveKind,
  MoveRow,
  PayeeRow,
  PinRow,
  TargetBehavior,
  TargetCadence,
  TargetRepeat,
  TargetRow,
  TargetSnoozeRow,
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

  async listTargets(): Promise<TargetRow[]> {
    const stmt = await this.db.prepare(
      `SELECT * FROM targets WHERE budget_id = ? AND deleted_at IS NULL`,
    )
    return (await stmt.all(this.budgetId)) as TargetRow[]
  }

  async listTargetSnoozes(): Promise<TargetSnoozeRow[]> {
    const stmt = await this.db.prepare(
      `SELECT * FROM target_snoozes WHERE budget_id = ? AND deleted_at IS NULL`,
    )
    return (await stmt.all(this.budgetId)) as TargetSnoozeRow[]
  }

  async listMoves(): Promise<MoveRow[]> {
    const stmt = await this.db.prepare(
      `SELECT * FROM moves WHERE budget_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
    )
    return (await stmt.all(this.budgetId)) as MoveRow[]
  }

  async listSettings(): Promise<BudgetSettingRow[]> {
    const stmt = await this.db.prepare(
      `SELECT * FROM budget_settings WHERE budget_id = ? AND deleted_at IS NULL`,
    )
    return (await stmt.all(this.budgetId)) as BudgetSettingRow[]
  }

  async getSetting(key: string): Promise<string | null> {
    const stmt = await this.db.prepare(
      `SELECT value FROM budget_settings WHERE budget_id = ? AND key = ? AND deleted_at IS NULL`,
    )
    const row = (await stmt.get(this.budgetId, key)) as { value: string } | undefined
    return row?.value ?? null
  }

  async setSetting(key: string, value: string): Promise<void> {
    const ts = now()
    const existing = (await this.listSettings()).find((s) => s.key === key)
    if (existing) {
      const upd = await this.db.prepare(
        `UPDATE budget_settings SET value = ?, updated_at = ? WHERE id = ?`,
      )
      await upd.run(value, ts, existing.id)
      return
    }
    const id = ulid()
    const ins = await this.db.prepare(
      `INSERT INTO budget_settings (id, budget_id, key, value, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    )
    await ins.run(id, this.budgetId, key, value, ts, ts)
  }

  async pinCategory(categoryId: string): Promise<void> {
    const existing = (await this.listPins()).find((p) => p.category_id === categoryId)
    if (existing) return
    const ts = now()
    const id = ulid()
    const sort = (await this.listPins()).length
    const ins = await this.db.prepare(
      `INSERT INTO pins (id, budget_id, category_id, sort_order, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    )
    await ins.run(id, this.budgetId, categoryId, sort, ts, ts)
  }

  async unpinCategory(categoryId: string): Promise<void> {
    const ts = now()
    const soft = await this.db.prepare(
      `UPDATE pins SET deleted_at = ?, updated_at = ? WHERE budget_id = ? AND category_id = ? AND deleted_at IS NULL`,
    )
    await soft.run(ts, ts, this.budgetId, categoryId)
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

  private async runTx<T>(fn: () => Promise<T>): Promise<T> {
    const runner = this.db.transaction(fn)
    return runner()
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

    if (input.transferAccountId) {
      const otherId = ulid()
      const transferTo = input.transferAccountId
      await this.runTx(async () => {
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
          null,
          input.memo ?? null,
          input.amountCentavos,
          input.cleared ?? 'uncleared',
          ts,
          ts,
        )
        const other = await this.db.prepare(
          `INSERT INTO transactions (id, budget_id, account_id, date, payee_id, category_id, memo, amount_centavos, cleared, approved, transfer_transaction_id, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, ?, ?, ?, NULL)`,
        )
        await other.run(
          otherId,
          this.budgetId,
          transferTo,
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
      })
    } else {
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
      payeeName: string
      accountId: string
      transferAccountId: string
    }>,
  ): Promise<void> {
    const ts = now()
    const current = (await this.listTransactions()).find((t) => t.id === id)
    if (!current) return

    let payeeId = patch.payeeId === undefined ? current.payee_id : patch.payeeId
    if (patch.payeeName) {
      payeeId = await this.ensurePayee(patch.payeeName, patch.transferAccountId)
    }

    const date = patch.date ?? current.date
    const amount = patch.amountCentavos ?? current.amount_centavos
    const memo = patch.memo === undefined ? current.memo : patch.memo
    const cleared = patch.cleared ?? current.cleared
    const categoryId = patch.categoryId === undefined ? current.category_id : patch.categoryId
    const accountId = patch.accountId ?? current.account_id

    if (current.transfer_transaction_id) {
      const otherId = current.transfer_transaction_id
      const other = (await this.listTransactions()).find((t) => t.id === otherId)
      const otherAccountId = patch.transferAccountId ?? other?.account_id ?? accountId
      await this.runTx(async () => {
        const upd = await this.db.prepare(
          `UPDATE transactions SET date = ?, amount_centavos = ?, memo = ?, cleared = ?, category_id = ?, payee_id = ?, account_id = ?, updated_at = ? WHERE id = ?`,
        )
        await upd.run(date, amount, memo, cleared, null, payeeId, accountId, ts, id)
        await upd.run(date, -amount, memo, cleared, null, payeeId, otherAccountId, ts, otherId)
      })
      return
    }

    const upd = await this.db.prepare(
      `UPDATE transactions SET date = ?, amount_centavos = ?, memo = ?, cleared = ?, category_id = ?, payee_id = ?, account_id = ?, updated_at = ? WHERE id = ?`,
    )
    await upd.run(date, amount, memo, cleared, categoryId, payeeId, accountId, ts, id)
  }

  async deleteTransaction(id: string): Promise<void> {
    const ts = now()
    const current = (await this.listTransactions()).find((t) => t.id === id)
    await this.runTx(async () => {
      const soft = await this.db.prepare(
        `UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ? OR transfer_transaction_id = ?`,
      )
      await soft.run(ts, ts, id, id)
      if (current?.transfer_transaction_id) {
        await soft.run(ts, ts, current.transfer_transaction_id, current.transfer_transaction_id)
      }
    })
  }

  async assign(categoryId: string, month: string, newAssignedCentavos: number): Promise<void> {
    const entries = (await this.listAssignments()).filter(
      (a) => a.category_id === categoryId && a.month === month,
    )
    const current = entries.reduce((s, e) => s + e.delta_centavos, 0)
    const delta = newAssignedCentavos - current
    if (delta === 0) return
    await this.recordMove('assign', month, [{ categoryId, deltaCentavos: delta }])
  }

  async recordMove(
    kind: MoveKind,
    month: string,
    deltas: { categoryId: string; deltaCentavos: number }[],
  ): Promise<string> {
    const ts = now()
    const moveId = ulid()
    await this.runTx(async () => {
      const moveIns = await this.db.prepare(
        `INSERT INTO moves (id, budget_id, kind, month, undone_at, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, NULL)`,
      )
      await moveIns.run(moveId, this.budgetId, kind, month, ts, ts)
      const asgIns = await this.db.prepare(
        `INSERT INTO assignment_entries (id, budget_id, category_id, month, delta_centavos, move_id, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      for (const d of deltas) {
        if (d.deltaCentavos === 0) continue
        await asgIns.run(
          ulid(),
          this.budgetId,
          d.categoryId,
          month,
          d.deltaCentavos,
          moveId,
          ts,
          ts,
        )
      }
    })
    return moveId
  }

  async upsertTarget(input: {
    categoryId: string
    cadence: TargetCadence
    behavior: TargetBehavior
    amountCentavos: number
    weekday?: number | null
    dueDay?: number | 'end' | null
    dueMonth?: string | null
    repeat?: TargetRepeat | null
    repeatBehavior?: 'set_aside' | 'refill' | null
  }): Promise<TargetRow> {
    const ts = now()
    const dueDay =
      input.dueDay === undefined || input.dueDay === null
        ? null
        : input.dueDay === 'end'
          ? 'end'
          : String(input.dueDay)
    const existing = (await this.listTargets()).find((t) => t.category_id === input.categoryId)
    if (existing) {
      const upd = await this.db.prepare(
        `UPDATE targets SET cadence = ?, behavior = ?, amount_centavos = ?, weekday = ?, due_day = ?,
         due_month = ?, repeat = ?, repeat_behavior = ?, updated_at = ? WHERE id = ?`,
      )
      await upd.run(
        input.cadence,
        input.behavior,
        input.amountCentavos,
        input.weekday ?? null,
        dueDay,
        input.dueMonth ?? null,
        input.repeat ?? null,
        input.repeatBehavior ?? null,
        ts,
        existing.id,
      )
      return (await this.listTargets()).find((t) => t.id === existing.id)!
    }
    const id = ulid()
    const ins = await this.db.prepare(
      `INSERT INTO targets (id, budget_id, category_id, cadence, behavior, amount_centavos, weekday, due_day, due_month, repeat, repeat_behavior, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
    await ins.run(
      id,
      this.budgetId,
      input.categoryId,
      input.cadence,
      input.behavior,
      input.amountCentavos,
      input.weekday ?? null,
      dueDay,
      input.dueMonth ?? null,
      input.repeat ?? null,
      input.repeatBehavior ?? null,
      ts,
      ts,
    )
    return (await this.listTargets()).find((t) => t.id === id)!
  }

  async deleteTarget(categoryId: string): Promise<void> {
    const ts = now()
    const soft = await this.db.prepare(
      `UPDATE targets SET deleted_at = ?, updated_at = ? WHERE budget_id = ? AND category_id = ? AND deleted_at IS NULL`,
    )
    await soft.run(ts, ts, this.budgetId, categoryId)
  }

  async snoozeTarget(categoryId: string, month: string): Promise<void> {
    const existing = (await this.listTargetSnoozes()).find(
      (s) => s.category_id === categoryId && s.month === month,
    )
    if (existing) return
    const ts = now()
    const id = ulid()
    const ins = await this.db.prepare(
      `INSERT INTO target_snoozes (id, budget_id, category_id, month, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    )
    await ins.run(id, this.budgetId, categoryId, month, ts, ts)
  }

  async unsnoozeTarget(categoryId: string, month: string): Promise<void> {
    const ts = now()
    const soft = await this.db.prepare(
      `UPDATE target_snoozes SET deleted_at = ?, updated_at = ? WHERE budget_id = ? AND category_id = ? AND month = ? AND deleted_at IS NULL`,
    )
    await soft.run(ts, ts, this.budgetId, categoryId, month)
  }

  /** Most recent non-undone move, if any. */
  async canUndo(): Promise<boolean> {
    const moves = await this.listMoves()
    return moves.some((m) => m.undone_at === null)
  }

  /** Redo only while the latest move is undone and nothing newer exists. */
  async canRedo(): Promise<boolean> {
    const moves = await this.listMoves()
    const latest = moves[0]
    return latest !== undefined && latest.undone_at !== null
  }

  async undoLastMove(): Promise<boolean> {
    const moves = await this.listMoves()
    const target = moves.find((m) => m.undone_at === null)
    if (!target) return false
    const ts = now()
    await this.runTx(async () => {
      const soft = await this.db.prepare(
        `UPDATE assignment_entries SET deleted_at = ?, updated_at = ? WHERE move_id = ? AND deleted_at IS NULL`,
      )
      await soft.run(ts, ts, target.id)
      const upd = await this.db.prepare(
        `UPDATE moves SET undone_at = ?, updated_at = ? WHERE id = ?`,
      )
      await upd.run(ts, ts, target.id)
    })
    return true
  }

  async redoLastMove(): Promise<boolean> {
    if (!(await this.canRedo())) return false
    const moves = await this.listMoves()
    const target = moves[0]!
    const ts = now()
    await this.runTx(async () => {
      const restore = await this.db.prepare(
        `UPDATE assignment_entries SET deleted_at = NULL, updated_at = ? WHERE move_id = ?`,
      )
      await restore.run(ts, target.id)
      const upd = await this.db.prepare(
        `UPDATE moves SET undone_at = NULL, updated_at = ? WHERE id = ?`,
      )
      await upd.run(ts, target.id)
    })
    return true
  }

  async listRecentMoves(sinceIso: string): Promise<Array<MoveRow & { entries: AssignmentRow[] }>> {
    const moves = (await this.listMoves()).filter((m) => m.created_at >= sinceIso)
    return Promise.all(
      moves.map(async (m) => ({
        ...m,
        entries: await this.listAssignmentsForMove(m.id),
      })),
    )
  }

  /** All assignment rows for a move (including soft-deleted after undo). */
  async listAssignmentsForMove(moveId: string): Promise<AssignmentRow[]> {
    const stmt = await this.db.prepare(
      `SELECT * FROM assignment_entries WHERE budget_id = ? AND move_id = ?`,
    )
    return (await stmt.all(this.budgetId, moveId)) as AssignmentRow[]
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

  async setCategoryNote(id: string, note: string | null): Promise<void> {
    const ts = now()
    const upd = await this.db.prepare(`UPDATE categories SET note = ?, updated_at = ? WHERE id = ?`)
    await upd.run(note, ts, id)
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
      version: 2,
      exportedAt: now(),
      budgets: [await this.getBudget()],
      accounts: await this.listAccounts(),
      categoryGroups: await this.listCategoryGroups(),
      categories: await this.listCategories(),
      payees: await this.listPayees(),
      transactions: await this.listTransactions(),
      assignments: await this.listAssignments(),
      pins: await this.listPins(),
      targets: await this.listTargets(),
      targetSnoozes: await this.listTargetSnoozes(),
      moves: await this.listMoves(),
      settings: await this.listSettings(),
    }
  }

  async importBackup(payload: BackupPayload): Promise<void> {
    const ts = now()
    const softDeleteTables = [
      'pins',
      'assignment_entries',
      'moves',
      'target_snoozes',
      'targets',
      'budget_settings',
      'transactions',
      'payees',
      'categories',
      'category_groups',
      'accounts',
    ] as const satisfies readonly SoftDeleteTable[]

    const targets = payload.version === 2 ? payload.targets : []
    const targetSnoozes = payload.version === 2 ? payload.targetSnoozes : []
    const moves = payload.version === 2 ? payload.moves : []
    const settings = payload.version === 2 ? payload.settings : []

    await this.runTx(async () => {
      for (const table of softDeleteTables) {
        await softDeleteBudgetRows(this.db, table, this.budgetId, ts)
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
      await insertAll(
        `INSERT OR REPLACE INTO targets (id, budget_id, category_id, cadence, behavior, amount_centavos, weekday, due_day, due_month, repeat, repeat_behavior, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        targets.map((t) => [
          t.id,
          this.budgetId,
          t.category_id,
          t.cadence,
          t.behavior,
          t.amount_centavos,
          t.weekday,
          t.due_day,
          t.due_month,
          t.repeat,
          t.repeat_behavior,
          t.created_at,
          t.updated_at,
          t.deleted_at,
        ]),
      )
      await insertAll(
        `INSERT OR REPLACE INTO target_snoozes (id, budget_id, category_id, month, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        targetSnoozes.map((s) => [
          s.id,
          this.budgetId,
          s.category_id,
          s.month,
          s.created_at,
          s.updated_at,
          s.deleted_at,
        ]),
      )
      await insertAll(
        `INSERT OR REPLACE INTO moves (id, budget_id, kind, month, undone_at, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        moves.map((m) => [
          m.id,
          this.budgetId,
          m.kind,
          m.month,
          m.undone_at,
          m.created_at,
          m.updated_at,
          m.deleted_at,
        ]),
      )
      await insertAll(
        `INSERT OR REPLACE INTO budget_settings (id, budget_id, key, value, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        settings.map((s) => [
          s.id,
          this.budgetId,
          s.key,
          s.value,
          s.created_at,
          s.updated_at,
          s.deleted_at,
        ]),
      )
    })
  }

  async clearAllData(): Promise<void> {
    const tables = [
      'pins',
      'assignment_entries',
      'moves',
      'target_snoozes',
      'targets',
      'budget_settings',
      'transactions',
      'payees',
      'categories',
      'category_groups',
      'accounts',
      'month_notes',
      'budgets',
      'meta',
    ] as const satisfies readonly ClearTable[]
    await this.runTx(async () => {
      for (const table of tables) {
        await clearTable(this.db, table)
      }
    })
  }
}

const SOFT_DELETE_SQL = {
  pins: `UPDATE pins SET deleted_at = ?, updated_at = ? WHERE budget_id = ? AND deleted_at IS NULL`,
  assignment_entries: `UPDATE assignment_entries SET deleted_at = ?, updated_at = ? WHERE budget_id = ? AND deleted_at IS NULL`,
  moves: `UPDATE moves SET deleted_at = ?, updated_at = ? WHERE budget_id = ? AND deleted_at IS NULL`,
  target_snoozes: `UPDATE target_snoozes SET deleted_at = ?, updated_at = ? WHERE budget_id = ? AND deleted_at IS NULL`,
  targets: `UPDATE targets SET deleted_at = ?, updated_at = ? WHERE budget_id = ? AND deleted_at IS NULL`,
  budget_settings: `UPDATE budget_settings SET deleted_at = ?, updated_at = ? WHERE budget_id = ? AND deleted_at IS NULL`,
  transactions: `UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE budget_id = ? AND deleted_at IS NULL`,
  payees: `UPDATE payees SET deleted_at = ?, updated_at = ? WHERE budget_id = ? AND deleted_at IS NULL`,
  categories: `UPDATE categories SET deleted_at = ?, updated_at = ? WHERE budget_id = ? AND deleted_at IS NULL`,
  category_groups: `UPDATE category_groups SET deleted_at = ?, updated_at = ? WHERE budget_id = ? AND deleted_at IS NULL`,
  accounts: `UPDATE accounts SET deleted_at = ?, updated_at = ? WHERE budget_id = ? AND deleted_at IS NULL`,
} as const

type SoftDeleteTable = keyof typeof SOFT_DELETE_SQL

const CLEAR_SQL = {
  pins: `DELETE FROM pins`,
  assignment_entries: `DELETE FROM assignment_entries`,
  moves: `DELETE FROM moves`,
  target_snoozes: `DELETE FROM target_snoozes`,
  targets: `DELETE FROM targets`,
  budget_settings: `DELETE FROM budget_settings`,
  transactions: `DELETE FROM transactions`,
  payees: `DELETE FROM payees`,
  categories: `DELETE FROM categories`,
  category_groups: `DELETE FROM category_groups`,
  accounts: `DELETE FROM accounts`,
  month_notes: `DELETE FROM month_notes`,
  budgets: `DELETE FROM budgets`,
  meta: `DELETE FROM meta`,
} as const

type ClearTable = keyof typeof CLEAR_SQL

async function softDeleteBudgetRows(
  db: Db,
  table: SoftDeleteTable,
  budgetId: string,
  ts: string,
): Promise<void> {
  const stmt = await db.prepare(SOFT_DELETE_SQL[table])
  await stmt.run(ts, ts, budgetId)
}

async function clearTable(db: Db, table: ClearTable): Promise<void> {
  await db.exec(CLEAR_SQL[table])
}
