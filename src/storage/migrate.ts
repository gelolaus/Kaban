import {
  LATEST_SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
  V1_SCHEMA_SQL,
  V2_SCHEMA_SQL,
} from './schema.ts'

/** Minimal surface migrate() needs — Turso Database or a Node test double. */
export interface MigratableDb {
  exec(sql: string): Promise<void>
  prepare(sql: string): Promise<{
    get(...params: unknown[]): Promise<unknown>
    all(...params: unknown[]): Promise<unknown[]>
    run(...params: unknown[]): Promise<unknown>
  }>
  transaction<T>(fn: () => Promise<T>): () => Promise<T>
}

async function readSchemaVersion(db: MigratableDb): Promise<number | null> {
  const stmt = await db.prepare(`SELECT value FROM meta WHERE key = ?`)
  const row = (await stmt.get(SCHEMA_VERSION_KEY)) as { value: string } | undefined
  if (!row) return null
  const n = Number(row.value)
  return Number.isInteger(n) ? n : null
}

async function writeSchemaVersion(db: MigratableDb, version: number): Promise<void> {
  const stmt = await db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  )
  await stmt.run(SCHEMA_VERSION_KEY, String(version))
}

async function runTx(db: MigratableDb, fn: () => Promise<void>): Promise<void> {
  const runner = db.transaction(fn)
  await runner()
}

/**
 * Apply CREATE TABLE IF NOT EXISTS for v1, stamp legacy DBs as version 1,
 * then run later migrations in order inside transactions.
 */
export async function migrate(db: MigratableDb): Promise<void> {
  await db.exec(V1_SCHEMA_SQL)

  let version = await readSchemaVersion(db)
  if (version === null) {
    await writeSchemaVersion(db, 1)
    version = 1
  }

  if (version < 2) {
    await runTx(db, async () => {
      await db.exec(V2_SCHEMA_SQL)
      await writeSchemaVersion(db, 2)
    })
    version = 2
  }

  if (version !== LATEST_SCHEMA_VERSION) {
    throw new Error(`Unsupported schema_version ${version}; expected ${LATEST_SCHEMA_VERSION}`)
  }
}
