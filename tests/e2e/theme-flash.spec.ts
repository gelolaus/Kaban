import { expect, test } from '@playwright/test'

test('pinned dark theme is applied before paint', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => {
    localStorage.setItem('kaban:color-scheme', 'dark')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const content = await page.locator('meta[name="color-scheme"]').getAttribute('content')
  expect(content).toBe('dark')
})

test('corrupt theme falls back to system', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('kaban:color-scheme', 'blue')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const content = await page.locator('meta[name="color-scheme"]').getAttribute('content')
  expect(content).toBe('light dark')
})

test('missing theme is system', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const content = await page.locator('meta[name="color-scheme"]').getAttribute('content')
  expect(content).toBe('light dark')
})
