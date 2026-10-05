import type { EnvReport } from './spike-api'

async function safePersisted(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persisted) return null
    return await navigator.storage.persisted()
  } catch {
    return null
  }
}

function safePersistSupported(): boolean {
  try {
    return typeof navigator.storage?.persist === 'function'
  } catch {
    return false
  }
}

async function safeEstimate(): Promise<{ quota: number | null; usage: number | null }> {
  try {
    if (!navigator.storage?.estimate) return { quota: null, usage: null }
    const estimate = await navigator.storage.estimate()
    return {
      quota: typeof estimate.quota === 'number' ? estimate.quota : null,
      usage: typeof estimate.usage === 'number' ? estimate.usage : null,
    }
  } catch {
    return { quota: null, usage: null }
  }
}

function safeOpfs(): boolean {
  try {
    return typeof navigator.storage?.getDirectory === 'function'
  } catch {
    return false
  }
}

export async function probeEnvironment(): Promise<EnvReport> {
  const estimate = await safeEstimate()
  return {
    secureContext: window.isSecureContext === true,
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    opfs: safeOpfs(),
    persisted: await safePersisted(),
    persistSupported: safePersistSupported(),
    quotaBytes: estimate.quota,
    usageBytes: estimate.usage,
    userAgent: navigator.userAgent,
  }
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator.storage?.persist !== 'function') return false
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
