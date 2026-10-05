import { connect, type Database } from '@tursodatabase/sync-wasm'

export type Db = Database

const DB_PATH = 'kaban.db'
const LOCK_NAME = 'kaban-db'

export class TabAlreadyOpenError extends Error {
  constructor() {
    super('Kaban is already open in another tab')
    this.name = 'TabAlreadyOpenError'
  }
}

let heldLockRelease: (() => void) | null = null

export async function acquireTabLock(): Promise<void> {
  if (!('locks' in navigator)) return
  const acquired = await new Promise<boolean>((resolve) => {
    void navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve(false)
        return
      }
      resolve(true)
      return new Promise<void>((release) => {
        heldLockRelease = release
      })
    })
  })
  if (!acquired) throw new TabAlreadyOpenError()
}

export function releaseTabLock(): void {
  heldLockRelease?.()
  heldLockRelease = null
}

export async function openDatabase(): Promise<Db> {
  await acquireTabLock()
  try {
    const db = await connect({ path: DB_PATH })
    await migrate(db)
    return db
  } catch (err) {
    releaseTabLock()
    throw err
  }
}

export async function migrate(db: Db): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      budget_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      on_budget INTEGER NOT NULL,
      closed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS category_groups (
      id TEXT PRIMARY KEY,
      budget_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      budget_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      kind TEXT NOT NULL DEFAULT 'normal',
      account_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS payees (
      id TEXT PRIMARY KEY,
      budget_id TEXT NOT NULL,
      name TEXT NOT NULL,
      transfer_account_id TEXT,
      last_category_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      budget_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      date TEXT NOT NULL,
      payee_id TEXT,
      category_id TEXT,
      memo TEXT,
      amount_centavos INTEGER NOT NULL,
      cleared TEXT NOT NULL DEFAULT 'uncleared',
      approved INTEGER NOT NULL DEFAULT 1,
      transfer_transaction_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS assignment_entries (
      id TEXT PRIMARY KEY,
      budget_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      month TEXT NOT NULL,
      delta_centavos INTEGER NOT NULL,
      move_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS pins (
      id TEXT PRIMARY KEY,
      budget_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS month_notes (
      id TEXT PRIMARY KEY,
      budget_id TEXT NOT NULL,
      month TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
  `)
}
