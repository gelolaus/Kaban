import { connect, type Database } from '@tursodatabase/sync-wasm'
import { ulid } from 'ulid'
import type { LedgerRow, OpenOptions } from './spike-api'

export interface SpikeDb {
  tableNames(): Promise<string[]>
  addLedger(category: string, delta: number): Promise<string>
  listLedger(): Promise<LedgerRow[]>
  setNote(id: string, value: string): Promise<void>
  getNote(id: string): Promise<string | null>
  push(): Promise<void>
  pull(): Promise<boolean>
  stats(): Promise<Record<string, unknown>>
  close(): Promise<void>
}

export async function openDb(opts: OpenOptions): Promise<SpikeDb> {
  const db: Database = await connect({
    path: 'kaban-spike.db',
    clientName: opts.device,
  })

  if (opts.ensureSchema !== false) {
    await db.exec(
      `CREATE TABLE IF NOT EXISTS ledger (
        id TEXT PRIMARY KEY,
        device TEXT NOT NULL,
        category TEXT NOT NULL,
        delta INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`,
    )
    await db.exec(
      `CREATE TABLE IF NOT EXISTS note (
        id TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    )
  }

  const device = opts.device

  return {
    async tableNames(): Promise<string[]> {
      const stmt = await db.prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      const rows = (await stmt.all()) as Array<{ name: string }>
      return rows.map((r) => r.name)
    },

    async addLedger(category: string, delta: number): Promise<string> {
      const id = ulid()
      const createdAt = new Date().toISOString()
      const stmt = await db.prepare(
        `INSERT INTO ledger (id, device, category, delta, created_at) VALUES (?, ?, ?, ?, ?)`,
      )
      await stmt.run(id, device, category, delta, createdAt)
      return id
    },

    async listLedger(): Promise<LedgerRow[]> {
      const stmt = await db.prepare(
        `SELECT id, device, category, delta, created_at FROM ledger ORDER BY id`,
      )
      return (await stmt.all()) as LedgerRow[]
    },

    async setNote(id: string, value: string): Promise<void> {
      const updatedAt = new Date().toISOString()
      const stmt = await db.prepare(
        `INSERT INTO note (id, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      await stmt.run(id, value, updatedAt)
    },

    async getNote(id: string): Promise<string | null> {
      const stmt = await db.prepare(`SELECT value FROM note WHERE id = ?`)
      const row = (await stmt.get(id)) as { value: string } | undefined
      return row?.value ?? null
    },

    async push(): Promise<void> {
      await db.push()
    },

    async pull(): Promise<boolean> {
      return await db.pull()
    },

    async stats(): Promise<Record<string, unknown>> {
      return (await db.stats()) as unknown as Record<string, unknown>
    },

    async close(): Promise<void> {
      await db.close()
    },
  }
}
