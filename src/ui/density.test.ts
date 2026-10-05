import { expect, test } from 'vitest'
import { applyDensity, DENSITY_KEY, readDensity } from './density.ts'

test('readDensity defaults to compact', () => {
  expect(readDensity({ getItem: () => null })).toBe('compact')
  expect(readDensity({ getItem: () => 'nope' })).toBe('compact')
  expect(readDensity({ getItem: () => 'comfortable' })).toBe('comfortable')
  expect(
    readDensity({
      getItem: () => {
        throw new Error('x')
      },
    }),
  ).toBe('compact')
})

test('applyDensity sets data-density', () => {
  const store: Record<string, string> = {}
  const el = { dataset: {} as Record<string, string> }
  const doc = { documentElement: el } as unknown as Document
  applyDensity('comfortable', doc, {
    setItem: (k, v) => {
      store[k] = v
    },
  })
  expect(el.dataset.density).toBe('comfortable')
  expect(store[DENSITY_KEY]).toBe('comfortable')
})
