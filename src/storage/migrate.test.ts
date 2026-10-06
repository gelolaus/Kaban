import { DatabaseSync } from 'node:sqlite'
import { describe, expect, test } from 'vitest'
import { migrate, type MigratableDb } from './migrate.ts'
import { SCHEMA_VERSION_KEY, V1_SCHEMA_SQL } from './schema.ts'

/** Wrap Node's sync sqlite so migrate() can run outside the browser Turso WASM. */
function openNodeDb(): MigratableDb & { close(): void; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:')
  return {
    raw,
    close() {
      raw.close()
    },
    async exec(sql: string) {
      raw.exec(sql)
    },
    async prepare(sql: string) {
      const stmt = raw.prepare(sql)
      return {
        async get(...params: unknown[]) {
          return stmt.get(...(params as never[]))
        },
        async all(...params: unknown[]) {
          return stmt.all(...(params as never[])) as unknown[]
        },
        async run(...params: unknown[]) {
          return stmt.run(...(params as never[]))
        },
      }
    },
    transaction<T>(fn: () => Promise<T>): () => Promise<T> {
      return async () => {
        raw.exec('BEGIN')
        try {
          const result = await fn()
          raw.exec('COMMIT')
          return result
        } catch (err) {
          raw.exec('ROLLBACK')
          throw err
        }
      }
    },
  }
}

describe('schema migrations', () => {
  test('version 1 database with data migrates to version 2 and keeps every row', async () => {
    const db = openNodeDb()
    try {
      // Build a legacy database the way phones and laptops already have it:
      // v1 tables only, no schema_version key.
      await db.exec(V1_SCHEMA_SQL)

      const ts = '2026-10-01T00:00:00.000Z'
      await (
        await db.prepare(
          `INSERT INTO budgets (id, name, currency, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, NULL)`,
        )
      ).run('bud1', 'Kaban', 'PHP', ts, ts)

      await (
        await db.prepare(
          `INSERT INTO accounts (id, budget_id, name, type, on_budget, closed, sort_order, note, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, 1, 0, 0, NULL, ?, ?, NULL)`,
        )
      ).run('acc1', 'bud1', 'Checking', 'checking', ts, ts)

      await (
        await db.prepare(
          `INSERT INTO category_groups (id, budget_id, name, sort_order, hidden, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, 0, 0, ?, ?, NULL)`,
        )
      ).run('grp1', 'bud1', 'Bills', ts, ts)

      await (
        await db.prepare(
          `INSERT INTO categories (id, budget_id, group_id, name, sort_order, hidden, note, kind, account_id, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, 0, 0, NULL, 'normal', NULL, ?, ?, NULL)`,
        )
      ).run('cat1', 'bud1', 'grp1', 'Rent', ts, ts)

      await (
        await db.prepare(
          `INSERT INTO transactions (id, budget_id, account_id, date, payee_id, category_id, memo, amount_centavos, cleared, approved, transfer_transaction_id, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, 'cleared', 1, NULL, ?, ?, NULL)`,
        )
      ).run('tx1', 'bud1', 'acc1', '2026-10-01', 500_000, ts, ts)

      await (
        await db.prepare(
          `INSERT INTO assignment_entries (id, budget_id, category_id, month, delta_centavos, move_id, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
        )
      ).run('asg1', 'bud1', 'cat1', '2026-10', 200_000, ts, ts)

      const beforeAccounts = await (await db.prepare(`SELECT * FROM accounts`)).all()
      const beforeTx = await (await db.prepare(`SELECT * FROM transactions`)).all()
      const beforeAsg = await (await db.prepare(`SELECT * FROM assignment_entries`)).all()
      const beforeCats = await (await db.prepare(`SELECT * FROM categories`)).all()

      expect(
        await (await db.prepare(`SELECT value FROM meta WHERE key = ?`)).get(SCHEMA_VERSION_KEY),
      ).toBeUndefined()

      await migrate(db)

      const version = (await (
        await db.prepare(`SELECT value FROM meta WHERE key = ?`)
      ).get(SCHEMA_VERSION_KEY)) as { value: string }
      expect(version.value).toBe('2')

      expect(await (await db.prepare(`SELECT * FROM accounts`)).all()).toEqual(beforeAccounts)
      expect(await (await db.prepare(`SELECT * FROM transactions`)).all()).toEqual(beforeTx)
      expect(await (await db.prepare(`SELECT * FROM assignment_entries`)).all()).toEqual(beforeAsg)
      expect(await (await db.prepare(`SELECT * FROM categories`)).all()).toEqual(beforeCats)

      const tables = (
        (await (
          await db.prepare(
            `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('targets', 'target_snoozes', 'moves', 'budget_settings') ORDER BY name`,
          )
        ).all()) as Array<{ name: string }>
      ).map((r) => r.name)
      expect(tables).toEqual(['budget_settings', 'moves', 'target_snoozes', 'targets'])
    } finally {
      db.close()
    }
  })

  test('migrate is idempotent on an already version-2 database', async () => {
    const db = openNodeDb()
    try {
      await migrate(db)
      await migrate(db)
      const version = (await (
        await db.prepare(`SELECT value FROM meta WHERE key = ?`)
      ).get(SCHEMA_VERSION_KEY)) as { value: string }
      expect(version.value).toBe('2')
    } finally {
      db.close()
    }
  })
})
