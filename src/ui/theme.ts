export type ThemePref = 'system' | 'light' | 'dark'

export const THEME_KEY = 'kaban:color-scheme'

export function readThemePref(storage: Pick<Storage, 'getItem'>): ThemePref {
  try {
    const v = storage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark') return v
    return 'system'
  } catch {
    return 'system'
  }
}

export function nextThemePref(current: ThemePref, systemIsDark: boolean): ThemePref {
  if (current === 'system') return systemIsDark ? 'light' : 'dark'
  return 'system'
}

export function colorSchemeContent(pref: ThemePref): 'light dark' | 'light' | 'dark' {
  if (pref === 'system') return 'light dark'
  return pref
}

export function applyThemePref(
  pref: ThemePref,
  doc: Document,
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
): void {
  const meta = doc.querySelector('meta[name="color-scheme"]')
  if (meta) meta.setAttribute('content', colorSchemeContent(pref))
  try {
    if (pref === 'system') storage.removeItem(THEME_KEY)
    else storage.setItem(THEME_KEY, pref)
  } catch {
    // ignore storage failures
  }
}
