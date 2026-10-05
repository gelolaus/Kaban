import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { dismissToast, showToast, subscribeToasts } from './toast.ts'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  // drain toasts
  let items: { id: string }[] = []
  const unsub = subscribeToasts((list) => {
    items = [...list]
  })
  for (const t of items) dismissToast(t.id)
  unsub()
})

test('showToast adds and auto-dismisses', () => {
  const seen: number[] = []
  const unsub = subscribeToasts((items) => seen.push(items.length))
  const id = showToast('Saved')
  expect(id).toBeTruthy()
  expect(seen.at(-1)).toBe(1)
  vi.advanceTimersByTime(3000)
  expect(seen.at(-1)).toBe(0)
  unsub()
})

test('error toasts persist', () => {
  let count = 0
  const unsub = subscribeToasts((items) => {
    count = items.length
  })
  showToast('Oops', { kind: 'error' })
  vi.advanceTimersByTime(60_000)
  expect(count).toBe(1)
  unsub()
})

test('action toasts persist until dismissed', () => {
  let count = 0
  const unsub = subscribeToasts((items) => {
    count = items.length
  })
  const id = showToast('Update ready', { action: { label: 'Reload', onAction: () => {} } })
  vi.advanceTimersByTime(5000)
  expect(count).toBe(1)
  dismissToast(id)
  expect(count).toBe(0)
  unsub()
})

test('dismiss unknown is no-op', () => {
  expect(() => dismissToast('nope')).not.toThrow()
})

test('ten rapid toasts', () => {
  let items: { id: string }[] = []
  const unsub = subscribeToasts((list) => {
    items = [...list]
  })
  const ids = Array.from({ length: 10 }, (_, i) => showToast(`m${i}`))
  expect(new Set(ids).size).toBe(10)
  expect(items.map((t) => t.id)).toEqual(ids)
  unsub()
})

test('custom duration', () => {
  let count = 0
  const unsub = subscribeToasts((items) => {
    count = items.length
  })
  showToast('Quick', { durationMs: 500 })
  vi.advanceTimersByTime(500)
  expect(count).toBe(0)
  unsub()
})

test('unsubscribe stops notifications', () => {
  let calls = 0
  const unsub = subscribeToasts(() => {
    calls++
  })
  unsub()
  const before = calls
  showToast('x')
  expect(calls).toBe(before)
})
