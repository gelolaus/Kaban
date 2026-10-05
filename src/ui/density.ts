export type Density = 'compact' | 'comfortable'

export const DENSITY_KEY = 'kaban:density'

export function readDensity(storage: Pick<Storage, 'getItem'>): Density {
  try {
    const v = storage.getItem(DENSITY_KEY)
    return v === 'comfortable' ? 'comfortable' : 'compact'
  } catch {
    return 'compact'
  }
}

export function applyDensity(d: Density, doc: Document, storage: Pick<Storage, 'setItem'>): void {
  doc.documentElement.dataset.density = d
  try {
    storage.setItem(DENSITY_KEY, d)
  } catch {
    // ignore
  }
}
