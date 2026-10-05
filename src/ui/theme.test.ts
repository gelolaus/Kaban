import { expect, test } from 'vitest'
import {
  applyThemePref,
  colorSchemeContent,
  nextThemePref,
  readThemePref,
  THEME_KEY,
} from './theme.ts'

function mem(initial: Record<string, string | null> = {}) {
  const store = { ...initial }
  return {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    store,
  }
}

test('readThemePref accepts light and dark', () => {
  expect(readThemePref(mem({ [THEME_KEY]: 'light' }))).toBe('light')
  expect(readThemePref(mem({ [THEME_KEY]: 'dark' }))).toBe('dark')
})

test('readThemePref falls back to system', () => {
  expect(readThemePref(mem({ [THEME_KEY]: null }))).toBe('system')
  expect(readThemePref(mem({ [THEME_KEY]: '' }))).toBe('system')
  expect(readThemePref(mem({ [THEME_KEY]: 'blue' }))).toBe('system')
  expect(readThemePref(mem({ [THEME_KEY]: 'LIGHT' }))).toBe('system')
  expect(readThemePref(mem({ [THEME_KEY]: '{"a":1}' }))).toBe('system')
  expect(
    readThemePref({
      getItem: () => {
        throw new Error('boom')
      },
    }),
  ).toBe('system')
})

test('nextThemePref toggles between system and opposite', () => {
  expect(nextThemePref('system', true)).toBe('light')
  expect(nextThemePref('system', false)).toBe('dark')
  expect(nextThemePref('dark', false)).toBe('system')
  expect(nextThemePref('light', true)).toBe('system')
})

test('pinned choice stays pinned', () => {
  const p = nextThemePref('system', false)
  expect(colorSchemeContent(p)).toBe('dark')
})

test('colorSchemeContent maps system', () => {
  expect(colorSchemeContent('system')).toBe('light dark')
  expect(colorSchemeContent('light')).toBe('light')
  expect(colorSchemeContent('dark')).toBe('dark')
})

test('applyThemePref updates meta and storage', () => {
  const storage = mem()
  const meta = {
    content: 'light dark',
    setAttribute(name: string, value: string) {
      if (name === 'content') this.content = value
    },
  }
  const doc = {
    querySelector: () => meta,
  } as unknown as Document
  applyThemePref('dark', doc, storage)
  expect(meta.content).toBe('dark')
  expect(storage.store[THEME_KEY]).toBe('dark')
  applyThemePref('system', doc, storage)
  expect(meta.content).toBe('light dark')
  expect(storage.store[THEME_KEY]).toBeUndefined()
})
