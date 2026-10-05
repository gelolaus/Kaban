import { expect, test } from 'vitest'
import { NAV_ITEMS, titleFor } from './nav.ts'

test('NAV_ITEMS order and flags', () => {
  expect(NAV_ITEMS.map((n) => n.path)).toEqual([
    '/home',
    '/plan',
    '/spending',
    '/accounts',
    '/reflect',
    '/settings',
  ])
  expect(NAV_ITEMS.find((n) => n.path === '/home')?.laptop).toBe(false)
  expect(NAV_ITEMS.find((n) => n.path === '/home')?.phone).toBe(true)
  expect(NAV_ITEMS.find((n) => n.path === '/settings')?.phone).toBe(false)
  expect(NAV_ITEMS.find((n) => n.path === '/accounts')?.phoneLabel).toBe('Accounts')
})

test('titleFor', () => {
  expect(titleFor('/plan')).toBe('Plan | Kaban')
  expect(titleFor('/accounts')).toBe('Accounts | Kaban')
  expect(titleFor('/')).toBe('Kaban')
  expect(titleFor('/nope')).toBe('Not found | Kaban')
  const titles = NAV_ITEMS.map((n) => titleFor(n.path))
  expect(new Set(titles).size).toBe(titles.length)
})
