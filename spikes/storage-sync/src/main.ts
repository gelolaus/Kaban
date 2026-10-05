import type { OpenOptions, SpikeApi } from './spike-api'
import { probeEnvironment, requestPersistence } from './probe'
import { openDb, type SpikeDb } from './db'

const CRED_DB = 'spike-credentials'
const CRED_STORE = 'kv'

let db: SpikeDb | null = null
let pairedUrl: string | undefined
let pairedToken: string | undefined

function requireDb(): SpikeDb {
  if (!db) throw new Error('database not open')
  return db
}

function openCredDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CRED_DB, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(CRED_STORE)) {
        database.createObjectStore(CRED_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

async function idbPut(key: string, value: string): Promise<void> {
  const database = await openCredDb()
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(CRED_STORE, 'readwrite')
    tx.objectStore(CRED_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'))
  })
  database.close()
}

async function idbGet(key: string): Promise<string | undefined> {
  const database = await openCredDb()
  const value = await new Promise<string | undefined>((resolve, reject) => {
    const tx = database.transaction(CRED_STORE, 'readonly')
    const request = tx.objectStore(CRED_STORE).get(key)
    request.onsuccess = () => {
      const result = request.result
      resolve(typeof result === 'string' ? result : undefined)
    }
    request.onerror = () => reject(request.error ?? new Error('IndexedDB get failed'))
  })
  database.close()
  return value
}

async function loadCredentials(): Promise<void> {
  pairedUrl = await idbGet('url')
  pairedToken = await idbGet('authToken')
  const urlInput = document.querySelector('#db-url')
  const tokenInput = document.querySelector('#db-token')
  if (urlInput instanceof HTMLInputElement && pairedUrl !== undefined) {
    urlInput.value = pairedUrl
  }
  if (tokenInput instanceof HTMLInputElement && pairedToken !== undefined) {
    tokenInput.value = pairedToken
  }
}

async function saveCredentials(url: string, authToken: string): Promise<void> {
  await idbPut('url', url)
  await idbPut('authToken', authToken)
  pairedUrl = url
  pairedToken = authToken
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
  resetRemote: async () => {
    const d = requireDb()
    await d.exec('DELETE FROM ledger')
    await d.exec('DELETE FROM note')
    await d.push()
  },
}

window.spike = spike

const pairForm = document.querySelector('#pair-form')
if (pairForm instanceof HTMLFormElement) {
  pairForm.addEventListener('submit', (event) => {
    event.preventDefault()
    void (async () => {
      try {
        const data = new FormData(pairForm)
        const url = String(data.get('url') ?? '').trim()
        const authToken = String(data.get('authToken') ?? '').trim()
        if (!url || !authToken) {
          await show({ error: 'url and token are required' })
          return
        }
        await saveCredentials(url, authToken)
        await spike.open({ device: 'paired', url, authToken })
        await show({ ok: true, paired: true })
      } catch (err) {
        await show({ error: err instanceof Error ? err.message : String(err) })
      }
    })()
  })
}

void loadCredentials()

onClick('Probe', () => spike.probe())
onClick('Persist', () => spike.persist())
onClick('Open local', () => spike.open({ device: 'local' }).then(() => ({ ok: true })))
onClick('Add ledger row', () => spike.addLedger('food', -100))
onClick('List rows', () => spike.listLedger())
onClick('Push', () => spike.push().then(() => ({ ok: true })))
onClick('Pull', () => spike.pull())
onClick('Stats', () => spike.stats())
