import type { OpenOptions, SpikeApi } from './spike-api'
import { probeEnvironment, requestPersistence } from './probe'
import { openDb, type SpikeDb } from './db'

let db: SpikeDb | null = null

function requireDb(): SpikeDb {
  if (!db) throw new Error('database not open')
  return db
}

async function show(result: unknown): Promise<void> {
  const out = document.querySelector('#out')
  if (!(out instanceof HTMLPreElement)) return
  try {
    out.textContent = JSON.stringify(result, null, 2)
  } catch {
    out.textContent = String(result)
  }
}

function onClick(label: string, handler: () => Promise<unknown>): void {
  const button = Array.from(document.querySelectorAll('button')).find(
    (el) => el.textContent === label,
  )
  if (!button) return
  button.addEventListener('click', () => {
    void (async () => {
      try {
        await show(await handler())
      } catch (err) {
        await show({ error: err instanceof Error ? err.message : String(err) })
      }
    })()
  })
}

const spike: SpikeApi = {
  probe: () => probeEnvironment(),
  persist: () => requestPersistence(),
  async open(opts: OpenOptions): Promise<void> {
    if (db) {
      await db.close()
      db = null
    }
    db = await openDb(opts)
  },
  tableNames: () => requireDb().tableNames(),
  addLedger: (category, delta) => requireDb().addLedger(category, delta),
  listLedger: () => requireDb().listLedger(),
  setNote: (id, value) => requireDb().setNote(id, value),
  getNote: (id) => requireDb().getNote(id),
  push: () => requireDb().push(),
  pull: () => requireDb().pull(),
  stats: () => requireDb().stats(),
  close: async () => {
    if (!db) return
    await db.close()
    db = null
  },
}

window.spike = spike

onClick('Probe', () => spike.probe())
onClick('Persist', () => spike.persist())
onClick('Open local', () => spike.open({ device: 'local' }).then(() => ({ ok: true })))
onClick('Add ledger row', () => spike.addLedger('food', -100))
onClick('List rows', () => spike.listLedger())
onClick('Push', () => spike.push().then(() => ({ ok: true })))
onClick('Pull', () => spike.pull())
onClick('Stats', () => spike.stats())
