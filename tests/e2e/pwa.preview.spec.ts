import { expect, test } from '@playwright/test'

test('manifest and offline shell', async ({ page, context }) => {
  const origins = new Set<string>()
  page.on('request', (req) => {
    const u = new URL(req.url())
    origins.add(u.origin)
  })

  const manifestRes = await page.request.get('/manifest.webmanifest')
  expect(manifestRes.ok()).toBe(true)
  const manifest = (await manifestRes.json()) as {
    name: string
    short_name: string
    display: string
    start_url: string
    theme_color: string
    background_color: string
    icons: Array<{ sizes: string; purpose?: string }>
  }
  expect(manifest.name).toBe('Kaban')
  expect(manifest.short_name).toBe('Kaban')
  expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toBe('/')
  expect(manifest.theme_color).toBe('#0C0806')
  expect(manifest.background_color).toBe('#0C0806')
  expect(manifest.icons.some((i) => i.sizes === '192x192')).toBe(true)
  expect(manifest.icons.some((i) => i.sizes === '512x512')).toBe(true)
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)

  await page.goto('/plan')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 60_000 })
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true))

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 60_000 })
  await page.goto('/spending')
  await expect(page.getByRole('heading', { name: 'Spending' })).toBeVisible({ timeout: 60_000 })

  for (const origin of origins) {
    expect(origin.includes('localhost') || origin.includes('127.0.0.1')).toBe(true)
  }
})
