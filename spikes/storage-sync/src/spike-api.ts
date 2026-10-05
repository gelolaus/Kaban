export interface EnvReport {
  secureContext: boolean
  crossOriginIsolated: boolean
  opfs: boolean
  persisted: boolean | null
  persistSupported: boolean
  quotaBytes: number | null
  usageBytes: number | null
  userAgent: string
}

export interface LedgerRow {
  id: string
  device: string
  category: string
  delta: number
  created_at: string
}

export interface OpenOptions {
  device: string
  url?: string
  authToken?: string
  ensureSchema?: boolean
}

export interface SpikeApi {
  probe(): Promise<EnvReport>
  open(opts: OpenOptions): Promise<void>
  tableNames(): Promise<string[]>
  addLedger(category: string, delta: number): Promise<string>
  listLedger(): Promise<LedgerRow[]>
  setNote(id: string, value: string): Promise<void>
  getNote(id: string): Promise<string | null>
  push(): Promise<void>
  pull(): Promise<boolean>
  stats(): Promise<Record<string, unknown>>
  persist(): Promise<boolean>
  close(): Promise<void>
}

declare global {
  interface Window {
    spike: SpikeApi
  }
}
