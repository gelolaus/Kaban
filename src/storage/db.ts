import { connect, type Database } from '@tursodatabase/sync-wasm'
import { migrate } from './migrate.ts'

export type Db = Database
export { migrate } from './migrate.ts'
export type { MigratableDb } from './migrate.ts'

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
