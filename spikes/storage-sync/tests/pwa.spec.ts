import { test, expect } from '@playwright/test'

test.describe('pwa preview', () => {
  test('T10: the built app works offline', async ({ page, context }) => {
    await page.goto('/')
    await page.waitForFunction(() => 'spike' in window)
    await page.waitForFunction(async () => {
      if (!('serviceWorker' in navigator)) return false
      const reg = await navigator.serviceWorker.ready
      return reg.active !== null
    })

    await page.evaluate(() => window.spike.open({ device: 'A' }))
    const id = await page.evaluate(() => window.spike.addLedger('pwa', -42))
    expect(id.length).toBeGreaterThan(0)

    await context.setOffline(true)
    await page.reload()
    await page.waitForFunction(() => 'spike' in window)

    const hasSpike = await page.evaluate(() => 'spike' in window)
    expect(hasSpike).toBe(true)

    await page.evaluate(() => window.spike.open({ device: 'A' }))
    const rows = await page.evaluate(() => window.spike.listLedger())
    expect(rows.some((r) => r.id === id && r.category === 'pwa' && r.delta === -42)).toBe(true)
  })

  test('T11: the wasm file is precached', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => 'spike' in window)
    await page.waitForFunction(async () => {
      if (!('serviceWorker' in navigator)) return false
      const reg = await navigator.serviceWorker.ready
      return reg.active !== null
    })

    const hasWasm = await page.evaluate(async () => {
      const names = await caches.keys()
      for (const name of names) {
        const cache = await caches.open(name)
        const requests = await cache.keys()
        if (requests.some((req) => req.url.endsWith('.wasm'))) return true
      }
      return false
    })
    expect(hasWasm).toBe(true)
  })
})
