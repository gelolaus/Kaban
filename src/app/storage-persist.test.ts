import { expect, test } from 'vitest'
import { requestPersistence } from './storage-persist.ts'

test('unsupported when missing', async () => {
  expect(await requestPersistence(undefined)).toBe('unsupported')
  expect(await requestPersistence({} as StorageManager)).toBe('unsupported')
})

test('granted when already persisted', async () => {
  const persist = async () => true
  expect(
    await requestPersistence({
      persisted: async () => true,
      persist,
    }),
  ).toBe('granted')
})

test('persist result', async () => {
  expect(
    await requestPersistence({
      persisted: async () => false,
      persist: async () => true,
    }),
  ).toBe('granted')
  expect(
    await requestPersistence({
      persisted: async () => false,
      persist: async () => false,
    }),
  ).toBe('denied')
  expect(
    await requestPersistence({
      persisted: async () => false,
      persist: async () => {
        throw new Error('no')
      },
    }),
  ).toBe('denied')
})
