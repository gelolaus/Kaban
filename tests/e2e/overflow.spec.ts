import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

const routes = ['/home', '/plan', '/spending', '/accounts', '/reflect', '/settings'] as const

async function waitAppReady(page: import('@playwright/test').Page, route: string) {
  await page.goto(route)
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const t = document.body?.innerText ?? ''
          if (
            !t ||
            t.includes('Opening local budget') ||
            t.includes('already open in another tab')
          ) {
            return false
          }
          return !!document.querySelector('.shell')
        }),
      { timeout: 60_000 },
    )
    .toBe(true)
  await expect(page.locator('.shell')).toBeVisible({ timeout: 60_000 })
}

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(scrollWidth, `scrollWidth ${scrollWidth} > innerWidth ${innerWidth}`).toBeLessThanOrEqual(
    innerWidth,
  )
}

async function assertTabsFullyVisible(page: import('@playwright/test').Page) {
  const tabs = page.getByRole('navigation', { name: 'Tabs' })
  await expect(tabs).toBeVisible()
  const items = tabs.getByRole('link')
  await expect(items).toHaveCount(5)
  const viewport = page.viewportSize()
  expect(viewport).toBeTruthy()
  for (let i = 0; i < 5; i++) {
    const box = await items.nth(i).boundingBox()
    expect(box, `tab ${i} missing box`).toBeTruthy()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
    expect(box!.width).toBeGreaterThan(0)
  }
}

for (const width of [390, 360] as const) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 800 })

    for (const route of routes) {
      await waitAppReady(page, route)
      await assertNoHorizontalOverflow(page)
      if (route !== '/settings') {
        await assertTabsFullyVisible(page)
      }
    }

    await waitAppReady(page, '/plan')
    await page.getByRole('button', { name: 'Transaction' }).click()
    await expect(page.getByRole('dialog', { name: 'New transaction' })).toBeVisible()
    await assertNoHorizontalOverflow(page)
    await assertTabsFullyVisible(page)
  })
}
