import type { LedgerRow, OpenOptions, SpikeApi } from './spike-api'
import { probeEnvironment, requestPersistence } from './probe'

function notImplemented(): never {
  throw new Error('not implemented')
}

const spike: SpikeApi = {
  probe: () => probeEnvironment(),
  persist: () => requestPersistence(),
  open: async (_opts: OpenOptions) => notImplemented(),
  tableNames: async () => notImplemented(),
  addLedger: async (_category: string, _delta: number) => notImplemented(),
  listLedger: async (): Promise<LedgerRow[]> => notImplemented(),
  setNote: async (_id: string, _value: string) => notImplemented(),
  getNote: async (_id: string) => notImplemented(),
  push: async () => notImplemented(),
  pull: async () => notImplemented(),
  stats: async () => notImplemented(),
  close: async () => notImplemented(),
}

window.spike = spike
